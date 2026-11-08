/**
 * tools/subset-font.ts —— 字体子集化｜文档 03 §8.1
 *
 * 1. 扫描 content/**（yaml+json）提取全部用字 → 用字表
 * 2. pyftsubset 按用字表裁剪思源宋体 → public/fonts/SourceHanSerifSC-subset.woff2
 *
 * 前置：pip install fonttools brotli；字体文件 fonts/SourceHanSerifSC-Regular.otf（自备，OFL 许可）
 * 本仓库不自带字体文件（许可与体积原因）；缺字体时仅输出用字表。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CONTENT = path.join(ROOT, 'content');
const FONT = path.join(ROOT, 'fonts/SourceHanSerifSC-Regular.otf');
const OUT_DIR = path.join(ROOT, 'public/fonts');

function collectChars(dir: string, acc: Set<string>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) collectChars(p, acc);
    else if (/\.(yaml|yml|json|md)$/.test(entry.name)) {
      for (const ch of fs.readFileSync(p, 'utf8')) acc.add(ch);
    }
  }
}

const chars = new Set<string>();
collectChars(CONTENT, chars);
// 常驻 UI 字
for (const ch of '天宫蟠桃会前夕入天门设置关闭正在铺陈云海按交谈撞击看席位牌拿起葫芦摘桃原文出处考据本作设定原著无载东西南北大小中特大标准高开弱关弱点击继续罢了齐天大圣府灵霄宝殿通明殿朝圣楼寿星台斗牛宫御马监披香殿斩妖台蟠桃园瑶池广寒宫兜率宫南天门东西北天河渡口宫殿海') {
  chars.add(ch);
}
const charset = [...chars].join('');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'charset.txt'), charset);
console.log(`用字表 ${chars.size} 字 → public/fonts/charset.txt`);

if (!fs.existsSync(FONT)) {
  console.log(`⚠️ 未找到 ${FONT}，跳过裁剪（运行时回退系统宋体栈）`);
  process.exit(0);
}
execFileSync('pyftsubset', [
  FONT,
  `--text=${charset}`,
  '--flavor=woff2',
  `--output-file=${path.join(OUT_DIR, 'SourceHanSerifSC-subset.woff2')}`,
  '--layout-features=*',
  '--no-hinting',
]);
const size = fs.statSync(path.join(OUT_DIR, 'SourceHanSerifSC-subset.woff2')).size;
console.log(`✅ 子集 ${(size / 1024).toFixed(0)} KB（预算 400–700 KB，文档 03 §8.1）`);
