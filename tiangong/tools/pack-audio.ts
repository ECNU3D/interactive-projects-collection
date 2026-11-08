/**
 * tools/pack-audio.ts —— 语音打包为 audio sprite｜文档 02 §9.2 / 文档 04 §7.3
 *
 * build/voice-raw/{pack}/*.flac
 *   → ffmpeg 双遍 loudnorm 归一化到 -16 LUFS（第二遍回填全部测量值 + offset）
 *   → 转 Opus/WebM 48kbps 单声道
 *   → 按角色拼接，条间 200ms 静音
 *   → 输出 public/audio/voice/{pack}.webm + {pack}.json（sprite 索引，毫秒）
 *
 * 用法：npx tsx tools/pack-audio.ts [--only pack1,pack2]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RAW = path.join(ROOT, 'build/voice-raw');
const OUT = path.join(ROOT, 'public/audio/voice');
const GAP_MS = 200; // 条间静音
const SAMPLE_RATE = 48000;
const BYTES_PER_SAMPLE = 2; // s16le mono

function ffmpeg(args: string[]): string {
  return execFileSync('ffmpeg', ['-y', '-hide_banner', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function ffmpegErr(args: string[]): string {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', ...args], { encoding: 'utf8' });
  return (r.stderr ?? '') + (r.stdout ?? '');
}

/**
 * 双遍 loudnorm：第一遍测量（JSON 在 stderr），第二遍回填全部四个测量值 + offset（文档 04 §7.3）。
 *
 * 输出 raw PCM（s16le 48k mono）而不是直接编码 opus —— sprite 索引必须与
 * 浏览器 decodeAudioData 之后的时间轴逐样本对齐，而 opus 是 20ms 帧编码、
 * 容器 duration 含 preskip/padding，比解码出的样本数长约 19ms/条。
 * 早先按 ffprobe 的容器时长累加 offset，到 sprite 中后段累积漂移近 2 秒，
 * 播放时把句首切掉（蟠桃园一带最明显）。PCM 没有帧对齐问题，字节数即样本数。
 */
function normalizeToPcm(inFile: string, outFile: string): void {
  const probe = ffmpegErr(['-i', inFile, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
  const match = probe.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!match) throw new Error(`loudnorm 测量失败：${inFile}`);
  const m = JSON.parse(match[0]) as Record<string, string>;
  ffmpeg([
    '-i', inFile,
    '-af',
    `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_LRA=${m.input_lra}:measured_TP=${m.input_tp}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=summary`,
    '-ar', String(SAMPLE_RATE), '-ac', '1', '-f', 's16le', '-acodec', 'pcm_s16le',
    outFile,
  ]);
}

/** raw PCM 的精确时长：字节数即样本数，没有容器/帧对齐的误差 */
function pcmDurationMs(file: string): number {
  const bytes = fs.statSync(file).size;
  return Math.round((bytes / BYTES_PER_SAMPLE / SAMPLE_RATE) * 1000);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;

  if (!fs.existsSync(RAW)) {
    console.error('❌ build/voice-raw 不存在，先跑 tools/gen-voice.ts');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = path.join(ROOT, '.cache/pack-tmp');
  fs.mkdirSync(tmp, { recursive: true });
  // 条间静音直接造 PCM 零字节，样本数精确
  const gapSamples = Math.round((GAP_MS / 1000) * SAMPLE_RATE);
  const gapBuf = Buffer.alloc(gapSamples * BYTES_PER_SAMPLE);

  const packs = fs.readdirSync(RAW).filter((d) => fs.statSync(path.join(RAW, d)).isDirectory());
  for (const pack of packs) {
    if (only && !only.includes(pack)) continue;
    const files = fs.readdirSync(path.join(RAW, pack)).filter((f) => f.endsWith('.flac')).sort();
    if (!files.length) continue;
    process.stdout.write(`📦 ${pack}（${files.length} 条）…`);
    const index: Record<string, [number, number]> = {};
    // 先全部转成 raw PCM，按字节数（= 样本数）累加游标，再整体编码一次。
    // 索引因此与解码后的时间轴逐样本一致，不会像按容器时长累加那样逐条漂移。
    const joined = path.join(tmp, `${pack}.raw`);
    const sink = fs.openSync(joined, 'w');
    let cursorSamples = 0;
    try {
      files.forEach((f, i) => {
        const id = f.replace(/\.flac$/, '');
        const pcm = path.join(tmp, `${pack}-${id}.pcm`);
        normalizeToPcm(path.join(RAW, pack, f), pcm);
        const bytes = fs.statSync(pcm).size;
        index[id] = [
          Math.round((cursorSamples / SAMPLE_RATE) * 1000),
          pcmDurationMs(pcm),
        ];
        fs.writeSync(sink, fs.readFileSync(pcm));
        cursorSamples += bytes / BYTES_PER_SAMPLE;
        if (i < files.length - 1) {
          fs.writeSync(sink, gapBuf);
          cursorSamples += gapSamples;
        }
      });
    } finally {
      fs.closeSync(sink);
    }
    ffmpeg([
      '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', '1', '-i', joined,
      '-c:a', 'libopus', '-b:a', '48k', path.join(OUT, `${pack}.webm`),
    ]);
    fs.unlinkSync(joined);
    fs.writeFileSync(path.join(OUT, `${pack}.json`), JSON.stringify(index));
    console.log(` ✓ ${(cursorSamples / SAMPLE_RATE).toFixed(1)}s`);
  }
  console.log('✅ 打包完成 →', OUT);
}

await main();
