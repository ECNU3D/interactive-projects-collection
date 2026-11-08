/**
 * tools/gen-bgm.ts —— MiniMax 音乐生成：三层 stem + 场景曲｜文档 04 §4
 *
 * 三层必须同调性同速度（60 BPM, D 羽调式），生成后用 ffmpeg 核对。
 * 用法：export MINIMAX_API_KEY=... && npx tsx tools/gen-bgm.ts [--only base,melody,grand]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'build/bgm-raw');
const MANIFEST = path.join(ROOT, '.cache/bgm-manifest.json');
const API = 'https://api.minimaxi.com/v1/music_generation';

const TRACKS: Record<string, string> = {
  // 三层 stem（文档 04 §4.3，同 60 BPM / D 羽调式）
  base: '中国传统器乐, 纯音乐, 极简, 环境音乐, 60 BPM, D 羽调式, 持续的笙长音与低频弦乐铺底, 偶尔一声磬, 大量空间混响, 无鼓点, 无旋律走向, 静谧, 庄严, 空旷, 云端, 适合长时间循环不引人注意',
  melody: '中国传统器乐, 纯音乐, 60 BPM, D 羽调式, 竹笛与埙的悠远旋律, 古琴散音点缀, 弦乐轻柔铺底, 飘渺, 出尘, 悠远, 有呼吸感, 旋律线简单克制不炫技, 大量留白',
  grand: '中国传统器乐, 纯音乐, 60 BPM, D 羽调式, 编钟与大鼓的庄严齐奏, 笙管齐鸣, 弦乐群铺满, 恢弘, 神圣, 天庭朝会, 帝王仪仗, 气势磅礴但不喧闹, 有克制的威严',
  // 场景曲（文档 04 §4.4）
  pantaoyuan: '中国传统器乐, 纯音乐, 明亮, 温暖, 65 BPM, 竹笛与琵琶轮指, 春日, 花园, 轻快但不欢闹, 有一丝甜',
  yaochi: '中国传统器乐, 纯音乐, 华丽, 55 BPM, 编磬与筝的琶音, 宴会前的静谧, 期待感, 一丝隐约的不安',
  guanghangong: '中国传统器乐, 纯音乐, 清冷, 极简, 50 BPM, 独奏箫与冰冷的钟声, 月夜, 孤寂, 遥远, 空灵, 无温暖音色',
  doushuaigong: '中国传统器乐, 纯音乐, 神秘, 50 BPM, 低频嗡鸣与稀疏的木鱼, 道观, 炼丹, 讲道, 时间静止感',
  nantianmen: '中国传统器乐, 纯音乐, 宏大, 从极静到爆发, 编钟长音渐强, 弦乐群上行, 揭幕感, 60 秒内完成一次情绪抬升',
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error('❌ 请设置 MINIMAX_API_KEY');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  const manifest: Record<string, string> = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};

  for (const [name, prompt] of Object.entries(TRACKS)) {
    if (only && !only.includes(name)) continue;
    const body = {
      model: 'music-2.6',
      prompt,
      is_instrumental: true,
      output_format: 'url',
      audio_setting: { sample_rate: 44100, bitrate: 256000, format: 'mp3' },
      aigc_watermark: false,
    };
    const hash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
    if (manifest[name] === hash) {
      console.log(`⏭ ${name} 未变更`);
      continue;
    }
    console.log(`🎵 ${name} 生成中…`);
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { base_resp?: { status_code: number; status_msg: string }; data?: { audio?: string } };
    if (json.base_resp?.status_code !== 0 || !json.data?.audio) {
      console.error(`  ✗ ${name}: ${json.base_resp?.status_code} ${json.base_resp?.status_msg}`);
      continue;
    }
    const buf = Buffer.from(await (await fetch(json.data.audio)).arrayBuffer());
    fs.writeFileSync(path.join(OUT, `${name}.mp3`), buf);
    manifest[name] = hash;
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
    console.log(`  ✓ ${name}.mp3（${(buf.length / 1e6).toFixed(1)} MB）——注意：转 Opus 后放入 public/audio/bgm/，三层须核对 BPM/调性（文档 04 §7.1b）`);
  }
}

await main();
