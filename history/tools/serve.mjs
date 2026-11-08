#!/usr/bin/env node
// tools/serve.mjs
// 零依赖本地静态文件服务器：项目自「走入历史」功能起需通过 http(s) 运行
// （SparkJS 仅发布 ES module 构建，file:// 协议下 ES module 会被浏览器 CORS 拒绝，
// 见 docs/superpowers/specs/2026-07-13-walk-into-history-gaussian-splat-design.md）。
// 用法：node tools/serve.mjs [port]（默认 8080）

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = parseInt(process.argv[2], 10) || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".spz": "application/octet-stream",
  ".ply": "application/octet-stream",
  ".splat": "application/octet-stream",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

// 解析 "Range: bytes=a-b" 单区间语法（章开篇影片走这条路：Safari 的 <video> 会先发
// Range: bytes=0-1 试探服务器支不支持分段，不给 206 就直接放弃加载）。只认单区间——
// 视频播放器不会发 "bytes=0-1,2-3" 这种多区间请求，多做等于给自己找 bug 面。
// 返回 null 表示"语法不认得，按无 Range 处理"（保持既有 200 全量行为，不当错误）；
// 返回 { invalid: true } 表示"语法认得但越界"，调用方应回 416，不能当 200 糊弄过去，
// 否则 Range: bytes=99999999- 这种请求会让 fs.createReadStream 拿到负长度而出怪问题。
function parseRange(rangeHeader, size) {
  var m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || "");
  if (!m || (m[1] === "" && m[2] === "")) return null;
  var start, end;
  if (m[1] === "") {
    // "bytes=-N"：末尾 N 字节
    var suffixLen = parseInt(m[2], 10);
    if (!isFinite(suffixLen) || suffixLen <= 0) return { invalid: true };
    start = Math.max(0, size - suffixLen);
    end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === "" ? size - 1 : parseInt(m[2], 10);
  }
  if (!isFinite(start) || !isFinite(end) || start > end || start < 0 || start >= size) {
    return { invalid: true };
  }
  if (end > size - 1) end = size - 1;
  return { start: start, end: end };
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split("?")[0]);
  } catch (e) {
    // 畸形百分号编码（如裸 "%"）会让 decodeURIComponent 同步抛 URIError，
    // 未捕获会终止整个进程；返回 400 保持服务器存活
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("400 Bad Request");
    return;
  }
  // 解码后含 NUL 字节的路径会让 fs.stat 同步抛 ERR_INVALID_ARG_VALUE（而非走回调），
  // 同样会击穿进程；与畸形编码一并挡在 400
  if (urlPath.includes("\0")) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("400 Bad Request");
    return;
  }
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(ROOT, urlPath);

  // 防御式路径穿越检查：解析后的绝对路径必须仍在项目根目录之内
  // （必须用 ROOT + path.sep 比较，裸 startsWith(ROOT) 会放行名字以 ROOT 为前缀的兄弟目录）
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found: " + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const range = parseRange(rangeHeader, stat.size);
      if (range && range.invalid) {
        res.writeHead(416, {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Range": "bytes */" + stat.size
        });
        res.end();
        return;
      }
      if (range) {
        res.writeHead(206, {
          "Content-Type": contentType,
          "Content-Length": range.end - range.start + 1,
          "Content-Range": "bytes " + range.start + "-" + range.end + "/" + stat.size,
          "Accept-Ranges": "bytes"
        });
        fs.createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
        return;
      }
      // 语法不认得（如多区间）：落回下面的整份 200，Accept-Ranges 头照样带上
    }

    res.writeHead(200, { "Content-Type": contentType, "Content-Length": stat.size, "Accept-Ranges": "bytes" });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error("端口 " + PORT + " 被占用，换个端口：node tools/serve.mjs <port>");
  } else {
    console.error("服务器启动失败：" + (err && err.message ? err.message : err));
  }
  process.exit(1);
});

// 仅绑定回环地址：本服务器面向本机开发预览、会原样吐出整个仓库，不得暴露给局域网
server.listen(PORT, "127.0.0.1", () => {
  console.log("《山河岁月》本地服务器已启动：http://localhost:" + PORT);
  console.log("按 Ctrl+C 停止");
});
