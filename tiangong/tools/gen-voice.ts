/**
 * tools/gen-voice.ts —— 批量调 MiniMax TTS 生成语音｜文档 02 §9.1
 *
 * 读 content/dialogue/*.yaml → 展开条目 → 合并角色级+行级 voice_setting
 * → 注入发音词典 → sha256 规范化请求体做增量 → 并发 4–8 调 /v1/t2a_v2
 * → 立即下载（url 24h 有效）→ build/voice-raw/{npc}/{id}.flac
 *
 * 用法：
 *   export MINIMAX_API_KEY=sk-...
 *   npx tsx tools/gen-voice.ts                # 全量（增量）
 *   npx tsx tools/gen-voice.ts --only taibai-jinxing,wukong-common
 *   npx tsx tools/gen-voice.ts --dry-run      # 只列出将生成的条目
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIALOGUE_DIR = path.join(ROOT, 'content/dialogue');
const OUT_DIR = path.join(ROOT, 'build/voice-raw');
const MANIFEST = path.join(ROOT, '.cache/voice-manifest.json');

const API = 'https://api.minimaxi.com/v1/t2a_v2';
const API_BACKUP = 'https://api-bj.minimaxi.com/v1/t2a_v2';

/** 悟空语音分片（文档 04 §8.1：天门/宫城/内苑/上层/通用） */
const WUKONG_SHARD_BY_REGION: Record<string, string> = {
  nantianmen: 'wukong-tianmen', dongtianmen: 'wukong-tianmen', xitianmen: 'wukong-tianmen', beitianmen: 'wukong-tianmen', tianhe: 'wukong-tianmen',
  gongdianhai: 'wukong-gongcheng', shouxingtai: 'wukong-gongcheng', chaoshenglou: 'wukong-gongcheng', tongmingdian: 'wukong-gongcheng', lingxiaodian: 'wukong-gongcheng', douniugong: 'wukong-gongcheng', yumajian: 'wukong-gongcheng', pixiangdian: 'wukong-gongcheng', zhanyaotai: 'wukong-gongcheng',
  pantaoyuan: 'wukong-neiyuan', 'qitian-fu': 'wukong-neiyuan', yaochi: 'wukong-neiyuan',
  guanghangong: 'wukong-shangceng', doushuaigong: 'wukong-shangceng',
};
/** NPC 文件 id → 所在区域（与 content/characters.json 一致） */
const characters = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/characters.json'), 'utf8')) as {
  characters: { id: string; region: string | null }[];
};
const REGION_BY_NPC = new Map(characters.characters.map((c) => [c.id, c.region]));

const pronunciation = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/pronunciation.json'), 'utf8'));

interface VoiceSetting { voice_id?: string; speed?: number; pitch?: number; vol?: number; emotion?: string }
interface Line { id: string; speaker?: string; text: string; voice_setting?: VoiceSetting; model?: string }
interface Topic { id: string; lines?: Line[] }
interface DFile { id: string; model?: string; voice_setting?: VoiceSetting; greet?: Line[]; topics?: Topic[]; fallback?: Line[]; bye?: Line[] }

interface Task {
  pack: string; // 语音包（= NPC id / wukong-* / narrator）
  lineId: string;
  body: Record<string, unknown>;
  hash: string;
}

function expandFile(file: string, df: DFile): Task[] {
  const tasks: Task[] = [];
  const npcFileId = file.replace(/\.yaml$/, '');
  const roleModel = df.model ?? 'speech-2.8-hd';
  const roleVs = df.voice_setting ?? {};
  const region = REGION_BY_NPC.get(npcFileId) ?? null;
  const wukongShard = region ? WUKONG_SHARD_BY_REGION[region] ?? 'wukong-common' : 'wukong-common';

  const all: Line[] = [
    ...(df.greet ?? []),
    ...(df.fallback ?? []),
    ...(df.bye ?? []),
    ...(df.topics ?? []).flatMap((t) => t.lines ?? []),
  ];
  for (const line of all) {
    const speaker = line.speaker ?? 'npc';
    // pc 台词 → 悟空分片包；narrator → 旁白包；npc → 本角色包（wukong.yaml 自身条目并入通用片）
    let pack = speaker === 'pc' ? (npcFileId === 'wukong' ? 'wukong-common' : wukongShard) : speaker === 'narrator' ? 'narrator' : npcFileId;
    if (pack === 'wukong') pack = 'wukong-common';
    // 语音参数：pc 用悟空设定（候选 C，文档 04 §6.2），narrator 用旁白设定
    let vs: VoiceSetting;
    let model: string;
    if (speaker === 'pc') {
      vs = { voice_id: 'Chinese (Mandarin)_Unrestrained_Young_Man', speed: 1.15, pitch: 2, emotion: 'happy' };
      model = 'speech-2.8-hd';
    } else if (speaker === 'narrator') {
      vs = { voice_id: 'Chinese (Mandarin)_Gentleman', speed: 0.92, pitch: -1, emotion: 'calm' };
      model = 'speech-2.8-hd';
    } else {
      vs = { ...roleVs };
      model = roleModel;
    }
    // 行级 override
    if (line.voice_setting) vs = { ...vs, ...line.voice_setting };
    if (line.model) model = line.model;
    // emotion fluent/whisper 强制 2.6-hd（文档 04 §1.3 硬约束）
    if ((vs.emotion === 'fluent' || vs.emotion === 'whisper') && model !== 'speech-2.6-hd') model = 'speech-2.6-hd';

    const body: Record<string, unknown> = {
      model,
      text: line.text,
      stream: false,
      output_format: 'url',
      voice_setting: {
        voice_id: vs.voice_id ?? '',
        speed: vs.speed ?? 1,
        vol: vs.vol ?? 1,
        pitch: vs.pitch ?? 0,
        emotion: vs.emotion ?? 'calm',
      },
      audio_setting: { sample_rate: 44100, format: 'flac', channel: 1 }, // 生成端无损（文档 02 §9.1）
      pronunciation_dict: pronunciation.pronunciation_dict,
      language_boost: 'Chinese',
      subtitle_enable: true,
    };
    // 玉帝的灵霄殿空旷回音写死进文件（文档 04 §3.7：只有他值得）
    if (npcFileId === 'yudi' && speaker === 'npc') {
      body.voice_modify = { sound_effects: 'spacious_echo' };
    }
    const hash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
    tasks.push({ pack, lineId: line.id, body, hash });
  }
  return tasks;
}

async function tts(apiKey: string, body: Record<string, unknown>, useBackup = false): Promise<{ url: string; subtitle?: string }> {
  const res = await fetch(useBackup ? API_BACKUP : API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    base_resp?: { status_code: number; status_msg: string };
    data?: { audio?: string; subtitle_file?: string };
  };
  const code = json.base_resp?.status_code ?? -1;
  if (code !== 0) {
    const msg = json.base_resp?.status_msg ?? 'unknown';
    const err = new Error(`MiniMax ${code}: ${msg}`) as Error & { code: number };
    err.code = code;
    throw err;
  }
  if (!json.data?.audio) throw new Error('响应无 audio url');
  return { url: json.data.audio, subtitle: json.data.subtitle_file };
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let delay = 2000;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code === 1004 || code === 2049) throw e; // 鉴权失败立即中止
      if (code === 1002 || code === 1039 || code === -1 || code === undefined) {
        console.warn(`  ⏳ ${label}: 限流(${code})，${delay / 1000}s 后重试 (${attempt + 1}/5)`);
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 30000);
        continue;
      }
      throw e;
    }
  }
  throw new Error(`${label}: 重试 5 次仍失败`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;
  const dryRun = args.includes('--dry-run');

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey && !dryRun) {
    console.error('❌ 请设置环境变量 MINIMAX_API_KEY（工具链不读密钥文件，文档 04 §1.1）');
    process.exit(1);
  }

  // 展开全部任务
  let tasks: Task[] = [];
  for (const f of fs.readdirSync(DIALOGUE_DIR).filter((f) => f.endsWith('.yaml'))) {
    const df = yaml.load(fs.readFileSync(path.join(DIALOGUE_DIR, f), 'utf8')) as DFile;
    tasks.push(...expandFile(f, df));
  }
  if (only) tasks = tasks.filter((t) => only.includes(t.pack) || only.includes(t.lineId));

  // 增量比对
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  const manifest: Record<string, string> = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  const pending = tasks.filter((t) => manifest[`${t.pack}/${t.lineId}`] !== t.hash);
  console.log(`共 ${tasks.length} 条，待生成 ${pending.length} 条（增量）`);
  if (dryRun) {
    const byPack = new Map<string, number>();
    for (const t of pending) byPack.set(t.pack, (byPack.get(t.pack) ?? 0) + 1);
    for (const [p, n] of [...byPack].sort()) console.log(`  ${p}: ${n}`);
    return;
  }

  // 并发 6（限流退避见 withRetry）
  let done = 0;
  let failed = 0;
  const queue = [...pending];
  async function worker(): Promise<void> {
    while (queue.length) {
      const t = queue.shift()!;
      const label = `${t.pack}/${t.lineId}`;
      try {
        const { url } = await withRetry(() => tts(apiKey!, t.body), label);
        // 立即下载（url 24h 有效）
        const audio = await withRetry(() => fetch(url).then((r) => r.arrayBuffer()), label + ' 下载');
        const dir = path.join(OUT_DIR, t.pack);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${t.lineId}.flac`), Buffer.from(audio));
        manifest[`${t.pack}/${t.lineId}`] = t.hash;
        done++;
        if (done % 25 === 0) {
          fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
          console.log(`  …${done}/${pending.length}`);
        }
      } catch (e) {
        failed++;
        console.error(`  ✗ ${label}: ${String(e).slice(0, 160)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  console.log(`✅ 完成 ${done} 条，失败 ${failed} 条 → ${OUT_DIR}`);
  if (failed) process.exit(2);
}

await main();
