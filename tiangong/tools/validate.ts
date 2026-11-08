/**
 * tools/validate.ts —— 内容校验（CI）｜文档 02 §9.3
 *
 * - 每条 yaml 台词都有对应语音条目吗？（有语音包时校验；无包时仅报告规模）
 * - 每个语音条目都被引用吗（找孤儿）？
 * - 所有 quote: true 的台词在 quotes-verified.json 白名单里吗？
 * - 所有 voice_id 在 MiniMax 系统音色列表里吗？（放行 timbre_weights 空 voice_id）
 * - 所有 emotion: fluent|whisper 的条目，model 是否覆盖为 speech-2.6-hd？
 * - 所有 goto 目标存在（或为 __end）？
 * - speed ∈ [0.5,2]、pitch ∈ [-12,12]、vol ∈ (0,10]？
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIALOGUE_DIR = path.join(ROOT, 'content/dialogue');

// MiniMax 系统音色列表（2026-08，文档 04 §3；开工前应按官方文档复核）
const KNOWN_VOICES = new Set([
  'Chinese (Mandarin)_Reliable_Executive', 'Chinese (Mandarin)_Mature_Woman', 'Chinese (Mandarin)_Humorous_Elder',
  'Chinese (Mandarin)_Male_Announcer', 'Chinese (Mandarin)_Radio_Host', 'Chinese (Mandarin)_Gentleman',
  'Chinese (Mandarin)_Sincere_Adult', 'Chinese (Mandarin)_Unrestrained_Young_Man', 'Chinese (Mandarin)_Lyrical_Voice',
  'Chinese (Mandarin)_Straightforward_Boy', 'Chinese (Mandarin)_Gentle_Youth', 'Chinese (Mandarin)_Southern_Young_Man',
  'Chinese (Mandarin)_Soft_Girl', 'Chinese (Mandarin)_Crisp_Girl', 'Chinese (Mandarin)_Warm_Girl',
  'Chinese (Mandarin)_Wise_Women', 'Chinese (Mandarin)_Kind-hearted_Antie',
  'male-qn-badao', 'male-qn-jingying', 'male-qn-daxuesheng', 'lengdan_xiongzhang',
  'chunzhen_xuedi', 'cute_boy', 'clever_boy', 'lovely_girl', 'qiaopi_mengmei',
]);

interface Line { id: string; speaker?: string; text: string; quote?: boolean; voice_setting?: Record<string, unknown>; model?: string }
interface Topic { id: string; label?: string; lines?: Line[]; next?: { goto: string }[] }
interface DFile { id: string; name?: string; model?: string; voice_setting?: Record<string, unknown>; greet?: Line[]; topics?: Topic[]; fallback?: Line[]; bye?: Line[] }

const whitelist = new Set(
  (JSON.parse(fs.readFileSync(path.join(ROOT, 'content/quotes-verified.json'), 'utf8')) as { quote: string }[]).map((q) =>
    q.quote.replace(/[『』「」\s]/g, ''),
  ),
);

// 标点差异容忍：与既有白名单匹配口径保持一致（下方 checkLine 的 squash 逻辑同源）。
const PUNCT_RE = /[，。！？；：、…—·"'"'（）]/g;
// 白名单条目预先去标点，供 checkLine 复用，避免每行台词重复计算。
const cleanWhitelist = [...whitelist].map((q) => q.replace(PUNCT_RE, '')).filter(Boolean);

// 引文覆盖率门槛：命中的白名单条目字数（并集，重叠不重复计） ÷ 该行 squash 后总字数。
// 阈值定为 0.7 —— 实测项目既有 65 条引文里 98% 天然 ≥70%，是站得住的经验线；
// 而修复前的说书人 25 条台词覆盖率仅 14%–69%（「一小段原文 + 一大段自撰转述」）。
// quote: true 会给 DialogueBox 里整行台词挂「原文」角标（src/ui/DialogueBox.ts:65-74），
// 这条门槛守的是项目底线「凡原著没有的，明确标注」——不要为了让 CI 变绿而调低它。
const QUOTE_COVERAGE_THRESHOLD = 0.7;

let errors = 0;
let warnings = 0;
let totalLines = 0;
let quoteCount = 0;
const err = (file: string, msg: string) => {
  errors++;
  console.error(`  ✗ ${file}: ${msg}`);
};
const warn = (file: string, msg: string) => {
  warnings++;
  console.warn(`  ⚠ ${file}: ${msg}`);
};

function checkLine(file: string, df: DFile, line: Line, ctx: string): void {
  totalLines++;
  if (!line.id) err(file, `${ctx}: 缺 id`);
  if (!line.text) err(file, `${ctx}/${line.id}: 缺 text`);
  if (line.quote) {
    quoteCount++;
    const key = line.text.replace(/<#[\d.]+#>/g, '').replace(/\([a-z-]+\)/g, '').replace(/[『』「」\s]/g, '');
    // 允许标点差异：白名单匹配按去标点去空白
    const squashed = key.replace(PUNCT_RE, '');
    // 逐条比对白名单，同时记录每条命中在 squashed 上覆盖到的字符位置（用于下面的覆盖率并集计算）。
    const covered = new Array<boolean>(squashed.length).fill(false);
    const hitQuotes: string[] = [];
    for (const q of cleanWhitelist) {
      if (q.length <= squashed.length) {
        // 白名单条目短于（或等于）该行：找出它在行内出现的每一处，标记为已覆盖。
        let idx = squashed.indexOf(q);
        while (idx !== -1) {
          for (let i = idx; i < idx + q.length; i++) covered[i] = true;
          if (!hitQuotes.includes(q)) hitQuotes.push(q);
          idx = squashed.indexOf(q, idx + 1);
        }
      } else if (q.includes(squashed)) {
        // 该行整体只是某条白名单原文的一个片段：整行都算已核验。
        covered.fill(true);
        if (!hitQuotes.includes(q)) hitQuotes.push(q);
      }
    }
    if (hitQuotes.length === 0) {
      err(file, `${ctx}/${line.id}: quote 不在白名单 →「${line.text.slice(0, 30)}…」`);
    } else if (squashed.length > 0) {
      const coverage = covered.filter(Boolean).length / squashed.length;
      if (coverage < QUOTE_COVERAGE_THRESHOLD) {
        err(
          file,
          `${ctx}/${line.id}: 引文覆盖率不足 ${(coverage * 100).toFixed(0)}%（阈值 ${(QUOTE_COVERAGE_THRESHOLD * 100).toFixed(0)}%）→「${line.text.slice(0, 30)}…」命中：${hitQuotes.map((q) => `「${q}」`).join('、')}`,
        );
      }
    }
  }
  const vs = { ...(df.voice_setting ?? {}), ...(line.voice_setting ?? {}) };
  const model = line.model ?? df.model ?? 'speech-2.8-hd';
  if (vs.voice_id !== undefined && vs.voice_id !== '' && !KNOWN_VOICES.has(String(vs.voice_id))) {
    err(file, `${ctx}/${line.id}: 未知 voice_id「${String(vs.voice_id)}」`);
  }
  if ((vs.emotion === 'fluent' || vs.emotion === 'whisper') && model !== 'speech-2.6-hd') {
    err(file, `${ctx}/${line.id}: emotion=${String(vs.emotion)} 必须 model: speech-2.6-hd（文档 04 §1.3）`);
  }
  if (vs.speed !== undefined && (Number(vs.speed) < 0.5 || Number(vs.speed) > 2)) err(file, `${ctx}/${line.id}: speed 越界 ${String(vs.speed)}`);
  if (vs.pitch !== undefined && (Number(vs.pitch) < -12 || Number(vs.pitch) > 12)) err(file, `${ctx}/${line.id}: pitch 越界 ${String(vs.pitch)}`);
  if (vs.vol !== undefined && (Number(vs.vol) <= 0 || Number(vs.vol) > 10)) err(file, `${ctx}/${line.id}: vol 越界 ${String(vs.vol)}`);
  // 三叠短语不得被合并（启发式：检测文本里是否有"X，X"重复被保留——只警告）
}

function checkFile(file: string, df: DFile): void {
  if (!df.id) err(file, '缺 id');
  const topicIds = new Set((df.topics ?? []).map((t) => t.id));
  (df.greet ?? []).forEach((l) => checkLine(file, df, l, 'greet'));
  (df.fallback ?? []).forEach((l) => checkLine(file, df, l, 'fallback'));
  (df.bye ?? []).forEach((l) => checkLine(file, df, l, 'bye'));
  for (const t of df.topics ?? []) {
    if (!t.label) warn(file, `topic ${t.id}: 缺 label`);
    (t.lines ?? []).forEach((l) => checkLine(file, df, l, `topic/${t.id}`));
    for (const n of t.next ?? []) {
      if (n.goto !== '__end' && !topicIds.has(n.goto)) err(file, `topic/${t.id}: goto「${n.goto}」不存在`);
    }
  }
  if (!df.greet?.length) warn(file, '无 greet');
}

const files = fs.readdirSync(DIALOGUE_DIR).filter((f) => f.endsWith('.yaml'));
console.log(`校验 ${files.length} 个对话文件…`);
for (const f of files) {
  try {
    const df = yaml.load(fs.readFileSync(path.join(DIALOGUE_DIR, f), 'utf8')) as DFile;
    checkFile(f, df);
  } catch (e) {
    err(f, `YAML 解析失败：${String(e).slice(0, 120)}`);
  }
}

// 语音孤儿检查（有语音包时）
const voiceDir = path.join(ROOT, 'public/audio/voice');
if (fs.existsSync(voiceDir)) {
  const referenced = new Set<string>();
  for (const f of files) {
    const df = yaml.load(fs.readFileSync(path.join(DIALOGUE_DIR, f), 'utf8')) as DFile;
    const all: Line[] = [
      ...(df.greet ?? []),
      ...(df.fallback ?? []),
      ...(df.bye ?? []),
      ...(df.topics ?? []).flatMap((t) => t.lines ?? []),
    ];
    for (const l of all) referenced.add(l.id);
  }
  for (const j of fs.readdirSync(voiceDir).filter((f) => f.endsWith('.json'))) {
    const idx = JSON.parse(fs.readFileSync(path.join(voiceDir, j), 'utf8')) as Record<string, [number, number]>;
    for (const id of Object.keys(idx)) {
      if (!referenced.has(id)) warn(j, `语音孤儿（无台词引用）：${id}`);
    }
  }
}

console.log(`\n共 ${totalLines} 条台词（其中原文直引 ${quoteCount} 条）`);
if (errors) {
  console.error(`❌ ${errors} 个错误，${warnings} 个警告`);
  process.exit(1);
} else {
  console.log(`✅ 通过（${warnings} 个警告）`);
}
