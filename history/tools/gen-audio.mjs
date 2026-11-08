#!/usr/bin/env node
// tools/gen-audio.mjs
// 《山河岁月》MiniMax 音频预生成脚本：为 93 事件 + 26 抉择 + 15 章引言生成 TTS 语音解说，
// 为全局/26 抉择/终章生成纯音乐 BGM，全部落盘为本地 mp3，供前端离线播放（file://，
// 运行期零网络请求）。API Key 从仓库根目录 `mini_max_api` 文件读取（已 gitignore）。
//
// 用法：
//   node tools/gen-audio.mjs                    生成全部 162 个文件（已存在且 >10KB 的跳过，可续跑）
//   node tools/gen-audio.mjs e0101 app           只生成指定任务（按 id：事件/抉择/章节 id 或 bgm id "app"/"c01"/"ending"）
//   node tools/gen-audio.mjs --list-voices       仅查询系统音色列表并打印候选，不生成任何文件
//
// 设计要点：
// - 用 vm 模块以沙箱方式加载 data/*.js（这些文件是普通 <script>，向 window.SHY_DATA 挂载），
//   不使用 ES module / JSON import，与前端加载方式解耦。
// - 限流重试：status_code 1002 → sleep 25s 重试，最多 5 次；1004/2049（鉴权失败）→ 抛出
//   FatalAuthError 立即中止整个脚本，绝不吞掉继续跑其余任务。
// - 音乐生成优先 model=music-2.6，非致命失败时自动降级 music-2.6-free 重试。
// - 每个文件生成后校验 mp3 magic bytes（"ID3" 或 0xFFEx/0xFFFx 帧同步）与 size>10KB，
//   不合格则整任务重试（最多 2 次），仍失败则记入失败清单、继续下一个任务（不中止全局）。
//
// 网络错误（"fetch failed"，非 1002 限流）的重试预算可用环境变量微调，默认值与原行为一致：
//   MM_TTS_RETRIES(=5) TTS 单次调用网络重试上限；MM_MUSIC_RETRIES(=3) music-2.6 网络重试上限；
//   MM_FREE_RETRIES(=5) music-2.6-free 网络重试上限；MM_TASK_ATTEMPTS(=2) 单文件整任务重试轮数。
// 在 MiniMax 音乐接口高延迟窗口（生成>~66s 会被链路超时切断连接）下，可调小这些值让失败更快落地，
// 配合外层「续跑循环」（已存在文件跳过）在多轮中骑过坏窗口，比单进程死等更高效。1002 限流处理不受此影响。

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const API_KEY = fs.readFileSync(path.join(ROOT, "mini_max_api"), "utf8").trim();
const T2A_URL = "https://api.minimaxi.com/v1/t2a_v2";
const MUSIC_URL = "https://api.minimaxi.com/v1/music_generation";
const VOICE_URL = "https://api.minimaxi.com/v1/get_voice";

// 沉稳磁性的中文男声、纪录片解说风格：经 --list-voices 查询系统音色列表（get_voice API，
// voice_type=system，303 个候选）逐一比对官方 description 后选定。候选对比见
// .superpowers/sdd/task-19-report.md「voice_id 选择」一节。
const VOICE_ID = "Chinese (Mandarin)_Male_Announcer"; // 播报男声——"一位富有磁性的中年男性播报员声音，标准普通话，清晰而权威"

// 网络错误重试预算（环境变量可覆盖，默认与原行为一致）
function envInt(name, def) {
  var v = parseInt(process.env[name] || "", 10);
  return Number.isFinite(v) && v > 0 ? v : def;
}
const TTS_RETRIES = envInt("MM_TTS_RETRIES", 5);
const MUSIC_RETRIES = envInt("MM_MUSIC_RETRIES", 3);
const FREE_RETRIES = envInt("MM_FREE_RETRIES", 5);
const TASK_ATTEMPTS = envInt("MM_TASK_ATTEMPTS", 2);

// ------------------------- 工具函数 -------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class FatalAuthError extends Error {}

function isValidMp3(buf) {
  if (!buf || buf.length < 10 * 1024) return false;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true; // "ID3" 头
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true; // MPEG 帧同步（0xFFEx/0xFFFx）
  return false;
}

// ------------------------- 数据加载（vm 沙箱，不用 ES module/JSON import） -------------------------

function loadData() {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  ["chapters.js", "events.js", "choices.js"].forEach((f) => {
    const code = fs.readFileSync(path.join(ROOT, "data", f), "utf8");
    vm.runInContext(code, sandbox, { filename: f });
  });
  return sandbox.window.SHY_DATA;
}

// ------------------------- 情绪选取（庄重口径：默认中性 calm，按关键词升级为 sad/fearful） -------------------------
// MiniMax emotion 枚举仅 8 项（happy/sad/angry/fearful/disgusted/surprised/calm/fluent/whisper），
// 无 "neutral"，庄重纪录片基调以 "calm" 承担中性角色。

const SAD_KEYWORDS = ["牺牲", "逝世", "殉", "阵亡", "罹难", "惨案", "屠杀", "就义", "血债", "覆没", "焦土", "死难"];
const FEARFUL_KEYWORDS = ["夜半", "紧张", "围剿", "戒严", "搜捕", "风雪", "伏击", "突围", "秘密", "危在旦夕", "生死攸关"];

function pickEmotion(text) {
  var t = String(text || "");
  for (var i = 0; i < SAD_KEYWORDS.length; i++) {
    if (t.indexOf(SAD_KEYWORDS[i]) !== -1) return "sad";
  }
  for (var j = 0; j < FEARFUL_KEYWORDS.length; j++) {
    if (t.indexOf(FEARFUL_KEYWORDS[j]) !== -1) return "fearful";
  }
  return "calm";
}

// ------------------------- BGM prompt 清单（每个抉择按年代/情绪定制，均纯音乐无人声可循环） -------------------------

var BGM_SUFFIX = "约30秒的简短乐段，纯音乐，无人声，首尾氛围一致适合无缝循环播放。";

var BGM_PROMPTS = {
  app: "中国古琴与箫，宁静深远悠远，历史画卷徐徐展开，低音量氛围，适合循环播放，无人声。",
  ending: "庄重史诗弦乐与民乐交织，红色深情，致敬先辈，恢弘大气，约40秒乐段，纯音乐，无人声。",
  c01: "宫廷凝重古琴与编钟，烛影摇曳的深宫决断氛围，庄重迟疑，" + BGM_SUFFIX,
  c02: "古筝与箫低回婉转，士人忧思求索，破碎山河中的沉静反思，" + BGM_SUFFIX,
  c03: "琵琶急促轮指与低音鼓点，诡谲紧张，宫闱杀机四伏，" + BGM_SUFFIX,
  c04: "古琴与西洋弦乐交织，理想主义者的孤独与执着，壮志未酬的怅然，" + BGM_SUFFIX,
  c05: "编钟与铜管对话，新旧交锋，锐意革新中的凝重庄严，" + BGM_SUFFIX,
  c06: "古筝与鼓点交替，朝堂激辩，边疆危局下的压迫感，" + BGM_SUFFIX,
  c07: "低音提琴与埙，港湾压抑沉郁，山雨欲来的不安预感，" + BGM_SUFFIX,
  c08: "二胡如泣如诉，悲愤沉痛，割地赔款的家国屈辱，" + BGM_SUFFIX,
  c09: "古筝明快中暗藏不安弦乐，希望与危机并存的短暂春光，" + BGM_SUFFIX,
  c10: "唢呐与鼓点，民间悲壮混乱，蒙昧与反抗交织的乡野气息，" + BGM_SUFFIX,
  c11: "古筝与钢琴对话，青年意气思辨激昂，理想道路的求索，" + BGM_SUFFIX,
  c12: "夜半紧张弦乐低音，鼓点渐急，山雨欲来风满楼的起义前夜，" + BGM_SUFFIX,
  c13: "古琴悲怆与低音铜管，希望与失落交织，历史十字路口的怅惘，" + BGM_SUFFIX,
  c14: "钢琴清新与古筝对话，新旧文化交替，思想启蒙的清朗气息，" + BGM_SUFFIX,
  c15: "弦乐激昂澎湃，青年热血游行，家国情怀奔涌而出，" + BGM_SUFFIX,
  c16: "钢琴与弦乐思辨对话，求索真理的冷静与执着，" + BGM_SUFFIX,
  c17: "低音大提琴凝重深沉，白色恐怖下的悲壮压抑，孕育中的决心，" + BGM_SUFFIX,
  c18: "古琴与弦乐交织，冷静抉择，星火初燃的坚定转折，" + BGM_SUFFIX,
  c19: "风雪行军悲壮弦乐，艰难跋涉中透出希望微光，生死攸关的转折，" + BGM_SUFFIX,
  c20: "编钟低鸣与悲怆弦乐，山河破碎的沉痛，国难当头的悲愤，" + BGM_SUFFIX,
  c21: "弦乐紧张对峙，风云突变，历史抉择前的激烈交锋，" + BGM_SUFFIX,
  c22: "古琴与铜管交织，沉稳坚定，持久抗争到底的信念，" + BGM_SUFFIX,
  c23: "弦乐忐忑不安中见果决，孤身赴局的悲壮与勇气，" + BGM_SUFFIX,
  c24: "古筝与箫悠远苍凉，沧桑古都的抉择与释然，" + BGM_SUFFIX,
  c25: "保家卫国进行曲底色，铜管雄壮，将士出征的豪迈决绝，" + BGM_SUFFIX,
  c26: "晨曦希望弦乐，思想解冻的暖意，改革开放曙光初现，" + BGM_SUFFIX
};

// ------------------------- 任务清单构建 -------------------------

function buildTasks(data) {
  var narrationDir = path.join(ROOT, "assets/audio/narration");
  var bgmDir = path.join(ROOT, "assets/audio/bgm");
  var tasks = [];

  data.events.forEach(function (e) {
    var text = (e.title || "") + "。" + (e.summary || "");
    tasks.push({
      id: e.id,
      kind: "narration",
      outPath: path.join(narrationDir, e.id + ".mp3"),
      text: text,
      emotion: pickEmotion(text)
    });
  });

  data.choices.forEach(function (c) {
    var text = c.scene || "";
    tasks.push({
      id: c.id,
      kind: "narration",
      outPath: path.join(narrationDir, c.id + ".mp3"),
      text: text,
      emotion: pickEmotion(text)
    });
  });

  data.chapters.forEach(function (c) {
    var text = (c.title || "") + "。" + (c.intro || "");
    tasks.push({
      id: c.id,
      kind: "narration",
      outPath: path.join(narrationDir, c.id + ".mp3"),
      text: text,
      emotion: "calm"
    });
  });

  tasks.push({ id: "app", kind: "bgm", outPath: path.join(bgmDir, "app.mp3"), prompt: BGM_PROMPTS.app });
  for (var i = 1; i <= 26; i++) {
    var id = "c" + String(i).padStart(2, "0");
    tasks.push({ id: id, kind: "bgm", outPath: path.join(bgmDir, id + ".mp3"), prompt: BGM_PROMPTS[id] });
  }
  tasks.push({ id: "ending", kind: "bgm", outPath: path.join(bgmDir, "ending.mp3"), prompt: BGM_PROMPTS.ending });

  return tasks;
}

// ------------------------- HTTP 调用（含限流/鉴权失败处理） -------------------------

async function callApi(url, body, opts) {
  var maxRetries = (opts && opts.maxRetries) || 5;
  var attempt = 0;
  for (;;) {
    attempt++;
    var res, json;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: "Bearer " + API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      json = await res.json();
    } catch (err) {
      if (attempt > maxRetries) throw new Error("网络/解析失败（重试" + maxRetries + "次后放弃）：" + err.message);
      console.log("    [网络错误 重试" + attempt + "/" + maxRetries + "] " + err.message + "，5s后重试");
      await sleep(5000);
      continue;
    }
    var statusCode = json && json.base_resp ? json.base_resp.status_code : 0;
    if (statusCode === 0) return json;
    var statusMsg = (json && json.base_resp && json.base_resp.status_msg) || "";
    if (statusCode === 1004 || statusCode === 2049) {
      throw new FatalAuthError("鉴权失败 status_code=" + statusCode + " msg=" + statusMsg);
    }
    if (statusCode === 1002) {
      if (attempt > maxRetries) throw new Error("触发限流，重试" + maxRetries + "次仍失败");
      console.log("    [限流 重试" + attempt + "/" + maxRetries + "] status_code=1002，等待25s...");
      await sleep(25000);
      continue;
    }
    if (attempt > maxRetries) {
      throw new Error("API错误 status_code=" + statusCode + " msg=" + statusMsg);
    }
    console.log("    [错误 重试" + attempt + "/" + maxRetries + "] status_code=" + statusCode + " msg=" + statusMsg);
    await sleep(5000);
  }
}

async function generateNarration(task) {
  var body = {
    model: "speech-2.8-hd",
    text: task.text,
    stream: false,
    voice_setting: { voice_id: VOICE_ID, speed: 0.95, vol: 1, pitch: 0, emotion: task.emotion || "calm" },
    audio_setting: { sample_rate: 32000, bitrate: 64000, format: "mp3", channel: 1 }
  };
  var json = await callApi(T2A_URL, body, { maxRetries: TTS_RETRIES });
  var hex = json && json.data && json.data.audio;
  if (!hex) throw new Error("响应缺少 data.audio 字段");
  return Buffer.from(hex, "hex");
}

async function generateMusic(task) {
  var baseBody = {
    prompt: task.prompt,
    is_instrumental: true,
    output_format: "hex",
    audio_setting: { sample_rate: 44100, bitrate: 128000, format: "mp3" }
  };
  // 实测：music-2.6（付费）在本机网络下长期超时（>66s 链路被掐），music-2.6-free 反而能在
  // 窗口内返回——故 free 为主、付费为后备。
  try {
    var json = await callApi(MUSIC_URL, Object.assign({ model: "music-2.6-free" }, baseBody), { maxRetries: FREE_RETRIES });
    var hex = json && json.data && json.data.audio;
    if (!hex) throw new Error("响应缺少 data.audio 字段（music-2.6-free）");
    return { buffer: Buffer.from(hex, "hex"), modelUsed: "music-2.6-free" };
  } catch (err) {
    if (err instanceof FatalAuthError) throw err;
    console.log("    [后备] music-2.6-free 失败（" + err.message + "），改用 music-2.6 重试");
    var json2 = await callApi(MUSIC_URL, Object.assign({ model: "music-2.6" }, baseBody), { maxRetries: MUSIC_RETRIES });
    var hex2 = json2 && json2.data && json2.data.audio;
    if (!hex2) throw new Error("响应缺少 data.audio 字段（music-2.6）");
    return { buffer: Buffer.from(hex2, "hex"), modelUsed: "music-2.6" };
  }
}

// ------------------------- 单任务执行（校验 + 整任务重试 2 次） -------------------------

async function runTask(task, index, total) {
  var label = "[" + index + "/" + total + "] " + task.kind + "/" + task.id;
  fs.mkdirSync(path.dirname(task.outPath), { recursive: true });
  if (fs.existsSync(task.outPath) && fs.statSync(task.outPath).size > 10 * 1024) {
    console.log(label + " 已存在（续跑跳过）");
    return { id: task.id, status: "skipped" };
  }

  var lastErr = null;
  for (var attempt = 1; attempt <= TASK_ATTEMPTS; attempt++) {
    try {
      var buffer, modelUsed = null;
      if (task.kind === "narration") {
        buffer = await generateNarration(task);
      } else {
        var r = await generateMusic(task);
        buffer = r.buffer;
        modelUsed = r.modelUsed;
      }
      if (!isValidMp3(buffer)) {
        throw new Error("生成音频未通过mp3校验（size=" + (buffer ? buffer.length : 0) + "字节）");
      }
      fs.writeFileSync(task.outPath, buffer);
      console.log(
        label + " OK（" + (buffer.length / 1024).toFixed(1) + "KB" + (modelUsed ? ", model=" + modelUsed : "") + "）"
      );
      return { id: task.id, status: "ok", size: buffer.length, modelUsed: modelUsed };
    } catch (err) {
      if (err instanceof FatalAuthError) throw err;
      lastErr = err;
      console.log(label + " 第" + attempt + "次尝试失败：" + err.message);
      await sleep(2000);
    }
  }
  console.log(label + " 放弃（已重试" + TASK_ATTEMPTS + "次）：" + (lastErr && lastErr.message));
  return { id: task.id, status: "failed", error: lastErr && lastErr.message };
}

// ------------------------- 查询音色列表 -------------------------

async function listVoices() {
  var json = await callApi(VOICE_URL, { voice_type: "system" }, { maxRetries: 3 });
  var list = json.system_voice || [];
  console.log("系统音色共 " + list.length + " 个，中文男声候选：");
  list.forEach(function (v) {
    var id = v.voice_id || "";
    var name = v.voice_name || "";
    if (/male|Male/.test(id) || /男|沉稳|磁性|浑厚|新闻|主播|纪录|Reliable|Deep|Announcer|Gentleman/.test(name)) {
      console.log("  " + id + " | " + name + " | " + (v.description || []).join(";"));
    }
  });
}

// ------------------------- 主流程 -------------------------

async function main() {
  var args = process.argv.slice(2);
  if (args.indexOf("--list-voices") !== -1) {
    await listVoices();
    return;
  }

  var only = args.filter(function (a) {
    return a.indexOf("--") !== 0;
  });

  var data = loadData();
  var tasks = buildTasks(data);
  if (only.length) {
    var set = new Set(only);
    tasks = tasks.filter(function (t) {
      return set.has(t.id);
    });
  }

  console.log("共 " + tasks.length + " 个任务待处理（voice_id=" + VOICE_ID + "）\n");

  var results = [];
  for (var i = 0; i < tasks.length; i++) {
    var r = await runTask(tasks[i], i + 1, tasks.length);
    results.push(r);
    await sleep(300);
  }

  var ok = results.filter(function (r) { return r.status === "ok"; }).length;
  var skipped = results.filter(function (r) { return r.status === "skipped"; }).length;
  var failed = results.filter(function (r) { return r.status === "failed"; });

  console.log("\n完成：成功 " + ok + "，跳过 " + skipped + "，失败 " + failed.length);
  if (failed.length) {
    console.log("失败清单：" + failed.map(function (f) { return f.id + "(" + f.error + ")"; }).join(", "));
    process.exitCode = 1;
  }
}

main().catch(function (err) {
  if (err instanceof FatalAuthError) {
    console.error("\n致命错误（鉴权失败，脚本已中止）：" + err.message);
  } else {
    console.error("\n脚本异常终止：" + err.message);
  }
  process.exit(1);
});
