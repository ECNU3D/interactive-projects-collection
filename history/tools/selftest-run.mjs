#!/usr/bin/env node
// tools/selftest-run.mjs
// walkin-selftest.html 的可复现运行器：真实挂钟 headless Chrome + CDP 轮询结果。
//
// 为什么不用 --virtual-time-budget --dump-dom：SparkJS 的 .spz 解码走真实 Web Worker
// （postMessage 往返），Chrome 的虚拟时钟只为挂起的网络请求让路、不等待 Worker，
// 于是页面自己的 setTimeout/sleep 在虚拟时钟下瞬间跑完，而解码尚未真实完成——
// isInitialized 与损坏文件两类断言必然超时（Task 4 执行实测与根因分析，见
// .superpowers/sdd/task-4-report.md）。本脚本以真实时间轮询 #out 文本直至出现
// 「通过 N 项，失败 M 项」，并转发页面的未捕获异常（PAGEERROR 行）供回归检查。
//
// 用法：node tools/selftest-run.mjs <url> [timeoutSeconds=120]
// 输出：结果行原文（通过 N 项，失败 M 项 + 失败明细）；未捕获异常打印为 "PAGEERROR: ..."。
// 退出码：0 = 拿到结果行，1 = 超时/Chrome 启动失败。

import { spawn } from "node:child_process";
import http from "node:http";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const url = process.argv[2];
const timeoutSec = parseInt(process.argv[3], 10) || 120;
if (!url) {
  console.error("用法: node tools/selftest-run.mjs <url> [timeoutSeconds]");
  process.exit(1);
}

const port = 9000 + Math.floor(Math.random() * 1000);
const chrome = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=" + port,
  "--no-first-run",
  // 本运行器从不派发真实（trusted）用户手势，CDP/JS 合成的 click、KeyboardEvent 都不算数；
  // 没有这个 flag，未静音的 <video>/<audio>.play() 会被 Chrome 自动播放策略拒绝
  // （NotAllowedError），首次在 chapterfilm.js 自检段验证真实播放时实测复现。
  "--autoplay-policy=no-user-gesture-required",
  "--user-data-dir=" + (process.env.TMPDIR || "/tmp") + "/selftest-chrome-" + port,
  "about:blank"
], { stdio: "ignore" });

function cleanup(code) {
  try { chrome.kill(); } catch (e) { /* 已退出 */ }
  process.exit(code);
}
process.on("SIGINT", () => cleanup(1));

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 等 DevTools 端口就绪
let version = null;
for (let i = 0; i < 50; i++) {
  try { version = await getJson("/json/version"); break; } catch (e) { await sleep(200); }
}
if (!version) { console.error("Chrome DevTools 端口未就绪"); cleanup(1); }

const ws = new WebSocket(version.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
function send(method, params, sessionId) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const pageErrors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    const line = "PAGEERROR: " + (d.exception && d.exception.description || d.text);
    pageErrors.push(line);
    console.log(line);
  }
};

await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Runtime.enable", {}, sessionId);
await send("Page.enable", {}, sessionId);
await send("Page.navigate", { url }, sessionId);

const deadline = Date.now() + timeoutSec * 1000;
let resultText = null;
while (Date.now() < deadline) {
  await sleep(2000);
  try {
    const r = await send("Runtime.evaluate", {
      expression: "(document.getElementById('out')||{}).textContent || ''",
      returnByValue: true
    }, sessionId);
    const text = (r.result && r.result.value) || "";
    if (/通过 \d+ 项，失败 \d+ 项/.test(text)) { resultText = text.trim(); break; }
  } catch (e) { /* 页面导航间隙，继续轮询 */ }
}

if (resultText) {
  console.log(resultText);
  cleanup(0);
} else {
  console.error("超时（" + timeoutSec + "s）：未等到结果行");
  cleanup(1);
}
