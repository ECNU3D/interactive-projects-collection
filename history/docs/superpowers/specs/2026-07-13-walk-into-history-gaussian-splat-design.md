# 「走入历史」——高斯泼溅（Gaussian Splatting）沉浸漫游 设计文档

- 日期：2026-07-13
- 状态：已获用户批准
- 需求来源：用户直接提出——给沉浸抉择场景（`js/choice.js` 的全屏 overlay）新增一个"走入历史"功能，用高斯泼溅模型让玩家自由走入画面世界；已生成第1幕（c01，戊戌前夜养心殿）的模型 `assets/world/Imperial Court in Winter.spz`（47MB），其余幕留空，陆续补齐。

## 1. 背景与范围

《山河岁月》现有沉浸抉择界面（`choice.js`）已有三态互斥背景：水墨降级 → 封面 Ken Burns → 360° 环景拖拽（`凭栏远眺`模式）。本次在此基础上新增第四层、也是最深的沉浸层级："走入历史"——基于 [SparkJS](https://sparkjs.dev/docs/)（Three.js 生态的高斯泼溅渲染库）加载 `.spz` 高斯泼溅模型，玩家可用 WASD + 鼠标/触屏自由走动，而不只是环视。

范围只覆盖这一个新功能的接入；不涉及对已完成的 Task 1–19（数据、画卷、抉择、人物图谱、音频）做任何重构。

## 2. 关键架构决策：项目从"双击 file:// 即玩"改为"需本地服务器运行"

SparkJS 官方只发布 ES module 构建（`spark.module.js`），没有传统 `<script>`/UMD 版本。经实测验证（headless Chrome 加载最小 `type="module"` 测试页），`file://` 协议下加载 ES module 会被浏览器直接拒绝：

```
Access to script at 'file:///.../foo.mjs' from origin 'null' has been blocked by CORS policy:
Cross origin requests are only supported for protocol schemes: chrome, chrome-extension,
chrome-untrusted, data, http, https, isolated-app.
```

这是浏览器对 `file:` 源的硬限制（`file:` 被当作不透明的 `null` origin，模块脚本走 fetch 算法必被拦截），无法通过 SparkJS 或本项目自身的代码绕过。

**决策（用户确认）**：项目整体从"双击 index.html 即玩"转向"需要本地服务器"，不再维护/测试 file:// 兼容性。已完成的 `data/*.js`、`js/*.js` 等普通 `<script>` 文件不需要重写为 ES module——它们通过 http(s) 提供时行为不变，只是新增的 SparkJS 接入代码（`js/walkin.js`）需要 `type="module"`。

**配套工具**：新增 `tools/serve.mjs`——零依赖（仅用 Node 内置 `http`/`fs` 模块）静态文件服务器，用法：
```
node tools/serve.mjs        # 默认监听 http://localhost:8080
```
不引入 `npm install`/第三方包，延续项目"无构建依赖"的一贯原则，只是把"双击"换成"跑一条 node 命令"。`index.html` 顶部与相关文档需同步更新运行说明。

## 3. 依赖管理：本地 vendor，不用 CDN

沿用项目现有原则（`vendor/d3.v7.min.js` 已是先例）："无外部网络依赖"——即使现在需要本地服务器，也不应让游戏依赖 sparkjs.dev / jsdelivr 保持在线。

实测确认 SparkJS + three.js 的模块依赖图可以完整下载并本地化，用浏览器原生 **import map**（无需打包器）拼装：

新增文件（均为发布版官方构建，非本项目代码）：
```
vendor/
├── spark.module.min.js      # SparkJS 2.1.0，约5.0MB
├── three.module.min.js      # three.js 0.180.0 模块入口，约0.34MB
├── three.core.min.js        # three.module.min.js 内部依赖，约0.38MB
└── Pass.js                  # three.js "addons" 后处理基类，SparkJS 内部依赖，约4KB
```
总一次性payload ≈ 5.9MB（小于项目里单条 BGM 音频），加载后不再产生任何网络请求。

`index.html` 新增（在现有 `<script>` 加载序列之外，独立一段）：
```html
<script type="importmap">
{
  "imports": {
    "three": "./vendor/three.module.min.js",
    "three/addons/postprocessing/Pass.js": "./vendor/Pass.js",
    "@sparkjsdev/spark": "./vendor/spark.module.min.js"
  }
}
</script>
<script type="module" src="js/walkin.js"></script>
```

## 4. 资产命名与存在性探测

- **命名约定**：`assets/world/<choiceId>.spz`（例：`assets/world/c01.spz`）。纯文件名约定，零数据文件维护——以后放入新一幕的模型，直接按 `choiceId.spz` 命名丢进 `assets/world/` 目录即可，不需要改 `data/choices.js` 或任何清单文件。
- 现有 `assets/world/Imperial Court in Winter.spz` 需重命名为 `assets/world/c01.spz`（实现阶段执行）。
- **存在性探测**：`fetch(url, { method: "HEAD" })`，200 视为可用，其余（404/网络错误）视为"暂无模型"。每个 `choiceId` 只探测一次，结果按 `choiceId` 缓存在 `walkin.js` 内部的内存 `Map` 里（同一次会话内重复进出同一抉择不重复发请求；缓存归 `walkin.js` 私有状态所有，`choice.js` 只管调用 `probeAvailable`，不关心是否命中缓存）。
- **能力前置检查**：探测前先做一次 WebGL2 支持检测（`canvas.getContext("webgl2")`）；不支持的浏览器/设备直接判定功能不可用，不发 HEAD 请求。

## 5. 交互集成（`js/choice.js`）

- `openChoice()` 内，除现有背景探测外，新增一次 `SHY_WALKIN.probeAvailable(choiceId)` 异步探测。
- 探测通过（WebGL2 支持 **且** 对应 `.spz` 文件存在）→ 在右上角「凭栏远眺」按钮旁新增「走入历史」按钮；**否则该按钮完全不渲染**（不占位、不置灰、不提示"暂无模型"——用户已确认这一点，未来补齐模型时按钮自然"解锁"出现，不需要改代码）。
- 点击「走入历史」→ `SHY_WALKIN.open(choiceId)`，全屏 3D canvas 叠加在当前 overlay 之上；右上角「回到抉择」按钮 → `SHY_WALKIN.close()` 退出。
- 纯视觉层，与「凭栏远眺」（观景模式）同等地位：不触碰 `state`/计分/`answered` 写入；进入/退出不影响"是否已作答""是否需要继续答题"的既有状态机。
- **音频**：进入/退出 3D 漫游不触发任何 `SHY_AUDIO`/`SHY_VOICE`/`SHY_BGM` 调用——延续现有观景模式"纯视觉层不碰音频"的既定做法（`choice.js` 注释：*"观景模式未接触任何音频调用，天然不打断 BGM 与解说"*）。
- **键盘**：3D 漫游态下 Esc → 退出漫游回到抉择面板（不受"未作答不可用 Esc 跳过"规则约束，因为这不是跳过抉择，只是离开这一层可选的视觉沉浸）。
- **加载态**：`.spz`（47MB 级）加载期间显示进度条（`SplatLoader` 的 progress 回调换算百分比），避免长时间黑屏观感。

## 6. `js/walkin.js` 内部架构

**模块形态**：全项目唯一的 ES module 文件。挂载 `window.SHY_WALKIN = { probeAvailable(choiceId), open(choiceId), close(), isOpen() }`（isOpen 为实现阶段补充的契约接口：choice.js 在漫游打开期间冻结自身全部键盘捷径，杜绝不透明覆盖层背后的不可见状态变更），命名风格与既有 `SHY_APP`/`SHY_SCORE`/`SHY_VOICE`/`SHY_CHOICE` 等一致，作为普通脚本（`choice.js`）与模块脚本之间唯一的桥接点。

- `probeAvailable(choiceId)` 是**异步接口**，返回 `Promise<boolean>`（内部先查 WebGL2 支持位，再查内存缓存，缓存未命中才发 HEAD 请求并写入缓存）——`choice.js` 调用方须以 `.then()`/`await` 消费，不能当同步布尔值用；这意味着「走入历史」按钮是在 `openChoice()` 渲染完初始背景之后**异步补一次**加出来的，不阻塞抉择面板的其余渲染节奏。
- `open(choiceId)`/`close()` 是同步接口（内部各自的异步加载/清理逻辑自行处理，不对外暴露 Promise）。

**场景生命周期**（每次 `open(choiceId)` 全新创建，`close()` 完全销毁，不缓存复用——实现简单、无残留状态风险；`.spz` 文件本身可能命中浏览器 HTTP 缓存，重新加载未必重新走网络）：

1. 创建 `THREE.Scene` / `THREE.PerspectiveCamera` / `THREE.WebGLRenderer`（canvas 插入 overlay 顶层）/ `SparkRenderer`（`scene.add(spark)`）。
2. `new SplatMesh({ url: "assets/world/" + choiceId + ".spz" })`；加载中展示进度；加载失败（网络错误/文件损坏，区别于"文件不存在"——后者在第4节的探测阶段已经拦掉，这里针对"探测时存在但加载时失败"的边缘情况）展示"该幕漫游素材加载失败"提示，允许直接关闭返回，不影响游戏其他功能。
3. `SparkControls`（内部整合 `FpsMovement` + `PointerControls`）接管交互：桌面端 WASD 平移 + Q/E 垂直降升（SparkControls 原生键位）+ 鼠标拖动环视，移动端触屏拖动；不做碰撞检测/地面约束（SparkJS 本身不提供，超出本次范围，YAGNI）。
4. `requestAnimationFrame` 渲染循环；`close()` 时 `cancelAnimationFrame` 停止循环，并显式 `dispose()` renderer / SplatMesh / scene 释放 GPU 显存——47MB 级模型反复进出若不释放，长会话有显存耗尽风险，这是本设计明确要求实现校验的一点。

## 7. 错误处理总览

| 场景 | 处理 |
|------|------|
| 浏览器不支持 WebGL2 | 按钮不出现，不发探测请求 |
| `assets/world/<id>.spz` 不存在（404） | 按钮不出现 |
| 文件存在但加载/解析失败 | 按钮正常出现，点击后展示错误提示，可直接关闭返回，不阻塞其他功能 |
| 反复进出同一幕 3D 漫游 | 每次 `close()` 必须完整释放 GPU 资源，不允许显存持续增长 |

所有路径均不得抛出未捕获异常——延续项目里其它可选依赖（`SHY_VOICE`/`SHY_BGM` 等）"文件缺失/加载失败静默降级"的一贯做法。

## 8. 测试与验收

- `node --check js/walkin.js`（Node 对 ESM 语法同样有效）。
- 启动 `node tools/serve.mjs`，用 headless Chrome 打开 `http://localhost:8080` 验证：
  - `validate.html` 数据自检仍是 1156/0（本功能不改任何 `data/*.js` 结构）；
  - c01 抉择打开后「走入历史」按钮出现，其余 25 幕不出现；
  - 点击进入 3D 漫游、WASD 移动、Esc 退出；多次进出后显存无持续增长；
  - console 无未捕获异常。
- **占位验证**：手动重命名/移走 `c01.spz` 模拟"该幕暂无模型"，确认按钮消失且无报错，验证探测降级路径。
- **file:// 不再测试**：项目自本功能起不再对 `file://` 双击运行做任何保证，README/运行说明需同步更新为"需本地服务器"。

## 9. 明确不做（YAGNI）

- 不做碰撞检测/地面高度约束（SparkJS 不提供，留给漫游体验"能穿墙"的已知限制）。
- 不做多幕模型同时预加载/资源池——每次进入当前幕才按需加载，退出即释放。
- 不做通过 http 之外协议（如 https 自签证书、局域网共享）的额外分发方案。
- 不为 file:// 用户做检测/降级提示横幅——直接以文档说明"需本地服务器"了事。
