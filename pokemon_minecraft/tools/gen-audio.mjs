#!/usr/bin/env node
// MiniMax 离线音频批量生成（设计文档 §14.6）
// 读取台词表与曲目表 → 调 MiniMax API → 下载 mp3 → 生成 manifest.json
// 用法: node tools/gen-audio.mjs [--bgm] [--voice] [--ambience]
// 密钥: 配音配乐/mini_max_api（绝不写进前端代码；该文件已在 .gitignore）
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DIALOGUES, VILLAGER_CHATTER, VOICE_PROFILES } from '../src/data/dialogues.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const KEY_FILE = path.join(ROOT, '配音配乐', 'mini_max_api');
const API = 'https://api.minimaxi.com';
const OUT = { bgm: 'assets/audio/bgm', voice: 'assets/audio/voice', ambience: 'assets/audio/ambience' };

const args = new Set(process.argv.slice(2));
const doAll = args.size === 0;
const doBgm = doAll || args.has('--bgm');
const doVoice = doAll || args.has('--voice');

function apiKey() {
  if (!existsSync(KEY_FILE)) { console.error('缺少密钥文件: ' + KEY_FILE); process.exit(1); }
  return readFileSync(KEY_FILE, 'utf8').trim();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(url, body, key, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(API + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    const code = json.base_resp?.status_code;
    if (code === 0) return json;
    if (code === 1002 || code === 1039) {           // 限流：等待重试
      console.log(`  限流，等待 ${(i + 1) * 10}s 重试…`);
      await sleep((i + 1) * 10000);
      continue;
    }
    throw new Error(`API 错误 ${code}: ${json.base_resp?.status_msg}`);
  }
  throw new Error('重试耗尽');
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('下载失败 ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

const hash = s => createHash('md5').update(s).digest('hex').slice(0, 10);

// ---- BGM（§14.2 music_generation，is_instrumental，output_format url） ----
async function genBgm(key, manifest) {
  const cfg = JSON.parse(readFileSync(path.join(ROOT, 'tools', 'bgm-prompts.json'), 'utf8'));
  mkdirSync(path.join(ROOT, OUT.bgm), { recursive: true });
  manifest.bgm = manifest.bgm || {};
  for (const [track, { prompt }] of Object.entries(cfg.tracks)) {
    const fname = `${track}_${hash(prompt)}.mp3`;
    const dest = path.join(ROOT, OUT.bgm, fname);
    if (existsSync(dest)) {                          // 已有素材跳过（增量生成）
      manifest.bgm[track] = fname;
      console.log(`跳过已有 ${track}`);
      continue;
    }
    console.log(`生成 BGM ${track}…`);
    try {
      const resp = await post('/v1/music_generation', {
        model: cfg.model,
        prompt,
        is_instrumental: true,
        output_format: 'url',
        audio_setting: { sample_rate: 44100, bitrate: 128000, format: 'mp3' },
      }, key);
      const audioUrl = resp.data?.audio;
      if (!audioUrl) throw new Error('响应无音频 URL: ' + JSON.stringify(resp).slice(0, 300));
      const size = await download(audioUrl, dest);   // url 24 小时有效，立即下载
      manifest.bgm[track] = fname;
      console.log(`  ✓ ${fname} (${(size / 1024).toFixed(0)} KB)`);
      await sleep(3000);                             // 限免模型 RPM 低：串行 + 间隔
    } catch (e) {
      console.error(`  ✗ ${track}: ${e.message}`);
    }
  }
}

// ---- 语音（§14.3 t2a_v2） ----
async function genVoice(key, manifest) {
  mkdirSync(path.join(ROOT, OUT.voice), { recursive: true });
  manifest.voice = manifest.voice || {};
  const lines = [];
  for (const [id, d] of Object.entries(DIALOGUES)) lines.push([id, d.voice, d.text]);
  // 村民闲聊语料
  for (const [profile, texts] of Object.entries(VILLAGER_CHATTER)) {
    texts.forEach((text, i) => lines.push([`chatter_${profile}_${i}`, profile, text]));
  }
  for (const [id, profile, text] of lines) {
    const p = VOICE_PROFILES[profile];
    if (!p) { console.warn(`未知音色 ${profile} (${id})`); continue; }
    const fname = `${id}_${hash(profile + text)}.mp3`;
    const dest = path.join(ROOT, OUT.voice, fname);
    if (existsSync(dest)) { manifest.voice[id] = fname; continue; }
    console.log(`生成语音 ${id}…`);
    try {
      const resp = await post('/v1/t2a_v2', {
        model: 'speech-2.8-hd',
        text,
        stream: false,
        voice_setting: { voice_id: p.voiceId, speed: 1, vol: 1, pitch: p.pitch, emotion: p.emotion },
        pronunciation_dict: { tone: ['皮卡丘/(pi2)(ka3)(qiu1)', '宝可梦/(bao3)(ke3)(meng4)'] },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
        subtitle_enable: false,
        language_boost: 'Chinese',
      }, key);
      const hex = resp.data?.audio;
      if (!hex) throw new Error('响应无音频数据');
      writeFileSync(dest, Buffer.from(hex, 'hex'));
      manifest.voice[id] = fname;
      console.log(`  ✓ ${fname}`);
      await sleep(1200);
    } catch (e) {
      console.error(`  ✗ ${id}: ${e.message}`);
    }
  }
}

async function main() {
  const key = apiKey();
  const manifestPath = path.join(ROOT, 'assets/audio/manifest.json');
  let manifest = {};
  if (existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (doBgm) await genBgm(key, manifest);
  if (doVoice) await genVoice(key, manifest);
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, generatedAt: new Date().toISOString() }, null, 2));
  console.log('完成 → assets/audio/manifest.json');
}

main().catch(e => { console.error(e); process.exit(1); });
