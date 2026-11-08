#!/usr/bin/env node
// 赤壁之战 · 配音/配乐生成脚本
// 用法:
//   node 配音配乐/generate_audio.mjs                # 生成全部（8 段解说 + BGM）
//   node 配音配乐/generate_audio.mjs standoff       # 只生成某段解说（id 见 src/battle/script.js）
//   node 配音配乐/generate_audio.mjs bgm            # 只生成背景配乐
//   node 配音配乐/generate_audio.mjs narr           # 只生成全部解说
// API Key 从 配音配乐/mini_max_api 读取（文件内容即 key，运行时 trim），不硬编码。

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(__dirname, 'mini_max_api');
const OUT_DIR = path.join(__dirname, 'generated');
const PROJECT_ROOT = path.dirname(__dirname);

const TTS_URL = 'https://api.minimaxi.com/v1/t2a_v2';
const MUSIC_URL = 'https://api.minimaxi.com/v1/music_generation';

const TTS_MODEL = 'speech-2.6-hd';
const VOICES = ['male-qn-jingying', 'male-qn-badao', 'male-qn-qingse'];
const MUSIC_MODELS = ['music-2.6', 'music-2.6-free'];

// ---- 解说文案（以 src/battle/script.js 的 EVENTS 为唯一数据源）----
async function loadEvents() {
  const { EVENTS } = await import(path.join(PROJECT_ROOT, 'src/battle/script.js'));
  return EVENTS;
}

const BGM_PROMPT =
  '史诗战争配乐，中国古战场，纯器乐无人声。开篇低沉压抑：战鼓缓慢擂动、号角长鸣，' +
  '弦乐持续紧张酝酿；中段鼓点渐密，铜管与定音鼓层层推进，古筝刮奏与箫声点缀，' +
  '情绪推向爆发：全军冲锋般的磅礴管弦齐鸣；尾段骤然转苍凉，箫与大提琴独奏收束，余韵悠长。' +
  '电影原声风格，配器：战鼓、号角、定音鼓、弦乐群、铜管、古筝、箫。结构完整，时长尽量长。';

const BGM_LYRICS = '[Intro]\n[Build Up]\n[Drums]\n[Climax]\n[Outro]';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadKey() {
  const key = (existsSync(KEY_FILE) ? readFileSync(KEY_FILE, 'utf8') : '').trim();
  if (!key) throw new Error(`API key 为空: ${KEY_FILE}`);
  return key;
}

async function postJson(url, key, body, timeoutMs = 300000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status}: 非 JSON 响应: ${text.slice(0, 200)}`); }
    const br = json.base_resp;
    if (!res.ok || (br && br.status_code !== 0)) {
      throw new Error(`HTTP ${res.status}, status_code=${br?.status_code}: ${br?.status_msg || res.statusText}`);
    }
    if (!json.data?.audio) throw new Error('响应缺少 data.audio');
    return json;
  } finally { clearTimeout(timer); }
}

async function withRetry(fn, label, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      console.log(`  [${label}] 第 ${i} 次失败: ${e.message}`);
      if (i < attempts) await sleep(2000);
    }
  }
  throw lastErr;
}

function saveHexAudio(hex, outFile) {
  const buf = Buffer.from(hex, 'hex');
  if (buf.length < 100) throw new Error(`音频数据过小 (${buf.length}B)`);
  return writeFile(outFile, buf).then(() => buf.length);
}

async function genNarration(key, ev) {
  const outFile = path.join(OUT_DIR, `narr_${ev.id}.mp3`);
  let usedVoice = null;
  for (const voice of VOICES) {
    try {
      const size = await withRetry(async () => {
        const json = await postJson(TTS_URL, key, {
          model: TTS_MODEL,
          text: ev.text,
          stream: false,
          voice_setting: { voice_id: voice, speed: 0.92, vol: 1, pitch: -1 },
          audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
          subtitle_enable: false,
        });
        return saveHexAudio(json.data.audio, outFile);
      }, `${ev.id}/${voice}`);
      usedVoice = voice;
      console.log(`✔ narr_${ev.id}.mp3  ${(size / 1024).toFixed(1)} KB  (voice=${voice})`);
      return { id: ev.id, ok: true, voice };
    } catch (e) {
      console.log(`  音色 ${voice} 对该段不可用: ${e.message}`);
    }
  }
  console.error(`✘ narr_${ev.id}.mp3 所有音色均失败`);
  return { id: ev.id, ok: false };
}

async function genBgm(key) {
  const outFile = path.join(OUT_DIR, 'bgm_battle.mp3');
  let lastErr;
  for (const model of MUSIC_MODELS) {
    try {
      const size = await withRetry(async () => {
        const json = await postJson(MUSIC_URL, key, {
          model,
          prompt: BGM_PROMPT,
          lyrics: BGM_LYRICS,
          is_instrumental: true,
          stream: false,
          output_format: 'hex',
          audio_setting: { sample_rate: 44100, bitrate: 256000, format: 'mp3' },
        });
        return saveHexAudio(json.data.audio, outFile);
      }, `bgm/${model}`, 2);
      console.log(`✔ bgm_battle.mp3  ${(size / 1024 / 1024).toFixed(2)} MB  (model=${model})`);
      return { ok: true, model };
    } catch (e) {
      lastErr = e;
      console.log(`  模型 ${model} 失败: ${e.message}`);
    }
  }
  console.error(`✘ bgm_battle.mp3 生成失败: ${lastErr?.message}`);
  return { ok: false };
}

async function main() {
  const filters = process.argv.slice(2).map((s) => s.toLowerCase());
  const key = loadKey();
  await mkdir(OUT_DIR, { recursive: true });

  const events = await loadEvents();
  const wantAll = filters.length === 0;
  const wantNarr = wantAll || filters.includes('narr');
  const wantBgm = wantAll || filters.includes('bgm') || filters.includes('music');
  const picked = events.filter((ev) => wantNarr || filters.includes(ev.id.toLowerCase()));
  const results = [];

  for (const ev of picked) {
    results.push(await genNarration(key, ev));
    await sleep(1000); // 限流间隔
  }
  if (wantBgm) {
    results.push({ id: 'bgm_battle', ...(await genBgm(key)) });
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n==== 汇总 ====');
  for (const r of results) console.log(`${r.ok ? '✔' : '✘'} ${r.id}${r.voice ? ` (${r.voice})` : ''}${r.model ? ` (${r.model})` : ''}`);
  if (failed.length) { console.error(`失败 ${failed.length} 项`); process.exit(1); }
  console.log('全部成功。输出目录: 配音配乐/generated/');
}

main().catch((e) => { console.error('致命错误:', e.message); process.exit(1); });
