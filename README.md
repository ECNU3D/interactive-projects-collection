# 互动项目合集

10 个独立的浏览器互动项目，包含源码及现有运行素材，方便下载、学习和继续开发。

| 项目目录 | 内容 | 启动方式 |
| --- | --- | --- |
| [三国](三国/) | 赤壁三维场景 | 静态服务后打开 `/三国/` |
| [水浒传](水浒传/) | 水浒三维互动场景 | 静态服务后打开 `/水浒传/` |
| [daguanyuan](daguanyuan/) | 红楼梦·大观园漫游 | 静态服务后打开 `/daguanyuan/` |
| [tiangong](tiangong/) | 西游记·天宫模拟器 | 在该目录运行 `npm install`、`npm run dev` |
| [3d_structure](3d_structure/) | 三维机械结构互动展览 | 在该目录运行 `npm install`、`npm run dev` |
| [history](history/) | 山河岁月·历史互动体验 | 静态服务后打开 `/history/` |
| [gb_game](gb_game/) | GB / GBC 风格网页游戏合集 | 静态服务后打开 `/gb_game/gb_game/` |
| [pokemon_minecraft](pokemon_minecraft/) | 宝可梦方块世界 | 静态服务后打开 `/pokemon_minecraft/` |
| [qingming_picture](qingming_picture/) | 清明上河图三维漫游 | 静态服务后打开 `/qingming_picture/` |
| [star_fox](star_fox/) | 星际火狐风格轨道射击 | 静态服务后打开 `/star_fox/` |

GBC 游戏入口：`/gb_game/gbc_game/03-zelda-links-awakening-dx.html`。

## 下载

点击 GitHub 页面上的 **Code → Download ZIP** 下载整个合集，或使用 `git clone`。音频、模型、历史影片与三维场景占用较大，完整目录约 1.6 GB；下载 ZIP 的压缩后大小取决于 GitHub 打包结果。

## Windows / macOS / Linux 运行

本仓库不捆绑 Node.js、Python、`node_modules` 或虚拟环境。请在自己的电脑安装需要的运行工具。普通浏览器游戏无需配置 API key，音频等现有素材已随项目保留。

多数项目使用 ES Modules，请通过 HTTP 静态服务打开，不要直接双击 HTML 文件。

在合集根目录打开终端，任选一种方式：

```bash
# 已安装 Node.js
npx --yes http-server . -p 8080 -c-1
```

```bash
# Windows，已安装 Python
py -m http.server 8080
```

```bash
# macOS / Linux，已安装 Python
python3 -m http.server 8080
```

然后在浏览器打开 `http://localhost:8080/`，选择项目目录。推荐使用支持 WebGL 的现代浏览器；天宫会根据浏览器能力使用 WebGPU 或 WebGL。

### 需要构建的两个项目

`tiangong` 与 `3d_structure` 是 Vite 工程，请分别在各自目录安装依赖并启动，终端会显示访问地址：

```bash
cd tiangong
npm install
npm run dev
```

`3d_structure` 同理。`3d_structure` 的 Node.js 版本要求为 `^20.19.0 || >=22.12.0`；具体依赖以各项目 `package.json` 与锁文件为准。构建生产版本可运行 `npm run build`。

## 分享副本的整理

- 保留源码、项目说明、浏览器运行所需的库、音频、图片、影片及模型。
- 排除本地 API key、凭证文件、环境变量文件、云服务器运维笔记、机器环境、缓存、日志、测试截图与生成中间产物。
- 不包含原项目 Git 历史，使用全新发布提交，避免将旧历史中的敏感内容带入。
- `history/productions` 为影片制作工程与重复中间素材，未打包；网页使用的成片保留在 `history/assets`。
- 水浒传保留代码实际引用的武松模型，未保留重复生成模型与中间导出。
- 三国使用的 Three.js 浏览器文件整理到 `三国/vendor/three`，保留其许可证；无需携带 `node_modules` 即可运行。

音频生成脚本属于可选开发工具，重新生成素材时需自行配置自己的服务凭证，相关本地密钥文件受 `.gitignore` 排除。部分原项目 README 仍描述这些本地配置路径；它们不随本仓库提供。

各项目原有说明、来源记录、第三方许可与归属信息保留在对应目录中。
