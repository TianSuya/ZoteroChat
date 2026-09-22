# 开发指南

## 快速开始

使用 Node.js 24（见根目录 `.nvmrc`）与 npm。贡献流程见
[CONTRIBUTING.md](../CONTRIBUTING.md)。

```bash
npm ci
npm start         # 启动独立开发实例
```

`npm start` 会拉起一个**独立的 Zotero 实例**：独立 profile、独立数据目录，
完全不碰你自己在用的 Zotero 和真实文献库。首次启动自动把 `fixtures/attention.pdf`
导入这个空库并打开阅读器。

配置在 `.env`（见 `.env.example`）：

```
ZOTERO_PLUGIN_ZOTERO_BIN_PATH=/Applications/Zotero.app/Contents/MacOS/zotero
ZOTERO_PLUGIN_PROFILE_PATH=~/Library/Application Support/ZoteroChatDev/profile
ZOTERO_PLUGIN_DATA_DIR=~/Library/Application Support/ZoteroChatDev/data
```

开发期 API key：设置页填写，或把 gitignore 的 `deepseek.key` 路径写进 pref
`devApiKeyFile`（仅当设置页 key 为空时回退，见 `src/llm/secrets.ts`）。默认端点
`https://api.deepseek.com`，模型 `deepseek-flash`，请求带 `thinking: { type: "disabled" }`。

夹具 PDF 放在 `fixtures/`（已 gitignore）。任意开放获取的论文都行：

```bash
curl -sL -o fixtures/attention.pdf https://arxiv.org/pdf/1706.03762v7
```

## 命令

| 命令                              | 作用                                      |
| --------------------------------- | ----------------------------------------- |
| `npm start`                       | 开发实例 + 热重载                         |
| `npm run build`                   | 类型检查 + 产出 `.scaffold/build/*.xpi`   |
| `npm run build:production`        | 跨平台设置 production 环境并构建 XPI      |
| `npm run typecheck`               | `tsc -b`，同时检查插件侧与面板侧          |
| `npm run lint` / `lint:fix`       | ESLint 检查 / 自动修复                    |
| `npm run format:check` / `format` | Prettier 格式检查 / 格式化                |
| `npm test`                        | vitest                                    |
| `npm run check`                   | lint + 格式 + 类型 + 单元测试，和 CI 一致 |

GitHub Actions 配置在 `.github/workflows/ci.yml`，使用 Node.js 24 执行
`npm ci`、`npm run check` 和生产构建，并保留 XPI 为构建产物。CI 不会启动
Zotero，也不会向模型端点发送请求；运行时兼容性仍需单独验证。

`.editorconfig`、`.gitattributes` 与 Prettier 统一文本格式。XHTML 模板保留手工排版，
避免格式化改变空白；自动生成目录、私有夹具和本地配置不参加格式检查。

## 构建管线

三个 esbuild entry，分别对应插件、对话面板和设置页：

| entry                     | 产物                             | target     | 说明                             |
| ------------------------- | -------------------------------- | ---------- | -------------------------------- |
| `src/index.ts`            | `content/scripts/zoterochat.js`  | firefox115 | 插件侧，无 React                 |
| `src/panel-app/index.tsx` | `content/scripts/panel.js`       | firefox115 | 面板侧，React + Radix + Tailwind |
| `src/prefs/pane.ts`       | `content/scripts/preferences.js` | firefox115 | 设置页 DOM                       |

## 打包安装包

```bash
npm run build:production
```

产物在 `.scaffold/build/` 下的 `.xpi`。可以拷到 `release/` 方便本地安装，但
**不要把 `.xpi` 提交进 git**（`*.xpi` 已 ignore）。对外发版：`npm run release`
（升版本、打 `v*` 标签），GitHub Actions 会上传 XPI 和 `update.json`。细节见
[release/README.md](../release/README.md)。

在自己的 Zotero 里：**工具 → 插件 → 齿轮 → 从文件安装插件…**。不要把开发用的
`deepseek.key` 打进包——key 只在设置页填写。

本地绝对不能提交的：

| 路径                     | 原因                                   |
| ------------------------ | -------------------------------------- |
| `deepseek.key` / `*.key` | API 密钥                               |
| `.env`                   | 本机 Zotero 路径（含用户目录）         |
| `fixtures/`              | 开发用 PDF                             |
| `.scaffold/`             | 构建产物与 Zotero 日志（可能含请求体） |
| `node_modules/`、`*.xpi` | 依赖与安装包                           |

`npm start` 用独立 profile（`ZoteroChatDev`）。日常文献库里的安装走 XPI，两套互不影响。

`target: firefox115` 是为 Zotero 7 留的下限，一份产物服务 7/8/9。

### Tailwind 以字符串打进 bundle

`zotero-plugin.config.ts` 里的 `tailwindAsString()` 插件把 Tailwind 产物编译成一个
虚拟模块 `virtual:panel-css`，导出为 JS 字符串；面板启动时注入 `<style>`。

这样做的原因是省掉一层文件与 URL 解析——面板文档是 `chrome://` 的，多一个 CSS 资源
就多一处可能出错的路径。

**注意**：class 扫描的增量性有限，改了 `.tsx` 里的 class 名后如果样式没跟上，
重启开发服务器。

## 开发回路的已知摩擦

### 改 `.ftl` 要完整重启

Fluent 文件有缓存，热重载不刷新。见
[environment.md §3.2](environment.md#32-ftl-有缓存热重载不刷新)。

### 热重载不会重载 iframe 内的文档

插件重载只重新加载插件侧 bundle。面板侧的 iframe 文档还是旧的，直到 section 被
重建。开发夹具会强制切一次 tab 触发重建，但如果看到"改了面板代码却没变化"，
完整重启。

### 探针只跑一次

探针有 `started.current` 守卫，每次挂载只跑一次。要重跑就完整重启。

## 验证探针

三个 dev-only 模块，**production 构建会被 esbuild 整个剔除**（靠 `__env__` define
做死代码消除）。默认关闭，靠 pref 开启，用于依赖升级后的回归检查。

| 探针                     | pref                    | 验证什么                                                                              |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------------- |
| `dev/radixProbe.tsx`     | `devShowRadixProbe`     | tooltip / dropdown / popover / cmdk 四类浮层在 iframe 内 portal、定位、锚定、取到样式 |
| `dev/assistantProbe.tsx` | `devShowAssistantProbe` | assistant-ui 运行时渲染、流式、capability gating                                      |
| `dev/checkSizing.ts`     | 总是运行（dev）         | 高度自适应在「静止」与「滚到顶」两种状态下都贴底                                      |

开启方式（`zotero-plugin.config.ts` 的 `server.prefs`）：

```ts
[`${pkg.config.prefsPrefix}.devShowRadixProbe`]: true,
```

**注意 Radix 探针会把四类浮层同时全部打开**，界面会重叠成一团——那是刻意的，
为了一次测完，不是 bug。

### 读探针结果

```bash
L=$(ls -t .scaffold/logs/zotero-*[0-9].log | head -1)
grep -n "RADIX PROBE" -A 40 "$L" | tail -44
grep -n "ASSISTANT PROBE" -A 24 "$L" | tail -26
grep -n "sizing check" "$L"
```

基线（通过时应该看到）：

```
RADIX PROBE       四项均 portaled/positioned/anchored = true
ASSISTANT PROBE   messageRows 2, streamedFully true,
                  capabilities.edit/delete/reload/switchToBranch 全 false
sizing check      @rest 与 @scrolled-to-top 的 gapBelow 都是 8
```

## 排查

### 日志在哪

```bash
ls -t .scaffold/logs/zotero-*.log | head -2      # 主日志 + stderr
grep -n "\[ZoteroChat\]" "$(ls -t .scaffold/logs/zotero-*[0-9].log | head -1)"
```

面板侧用 `report()` 输出，经 `window.parent.Zotero.debug` 汇到同一个日志，前缀
同样是 `[ZoteroChat]`。

### 面板整个白屏 / 内容消失

先看 `ERROR BOUNDARY`：

```bash
grep -n "ERROR BOUNDARY" "$(ls -t .scaffold/logs/zotero-*[0-9].log | head -1)"
```

`ui/ErrorBoundary.tsx` 会把渲染期异常和 componentStack 写进日志——面板文档里没有
可见的 console，没有它这类错误是完全静默的。

### 右侧 sidenav 没有插件图标

安装 XPI 后图标应始终在阅读器右侧栏。若没有：

1. 确认插件在「工具 → 插件」里已启用，然后**完全退出再开** Zotero（不只重载）。
2. 不要在 `onInit` 里 `setEnabled(false)`。那时 item 经常还是空的，图标会被藏掉
   且同轮 render 被跳过。见 [environment.md §6](environment.md#六item-pane-section-的渲染时机)。
3. 库视图点图标会看到「打开一个 PDF」空状态，这是预期；真正对话要在 reader 打开 PDF。

`npm start` 的开发实例已经加载源码，**不要再往这个实例里装 XPI**，会叠两份。

### 面板没出现 / 只有空状态

按顺序确认：

1. 当前是 reader tab 吗？库视图只会显示空状态。
2. 打开的是 PDF，或文献条目下挂了 PDF 附件吗？（`getPdfItem()` 会从父条目解析附件）
3. section 是展开的吗？折叠时 Zotero 会跳过 render
4. 日志里有 `panel frame created` 吗？

### 设置页「测试连接」没反应

脚本可能早于 XHTML 片段插入。确认 `preferences.xhtml` 根 `vbox` 有 `onload`，
测试按钮有 `onclick="ZoteroChat_Preferences.test()"`。见
[environment.md §8](environment.md#八设置页脚本早于片段-dom)。

日志：

```bash
grep -nE "ZoteroChat_Preferences|missing #zc" "$(ls -t .scaffold/logs/zotero-*[0-9].log | head -1)"
```

### 含公式的回复把面板卸掉 / 内存暴涨

XHTML `innerHTML` + MathML → `InvalidCharacterError`；`importNode` 死循环会吃光
内存。见 [environment.md §9](environment.md#九xhtml-面板不能-innerhtml-灌-html--mathml)
和 [adr/0007](adr/0007-xhtml-html-inject.md)。日志里先搜 `ERROR BOUNDARY` 和
`InvalidCharacterError`。

### 中文设置下回复夹杂英文句子

语言锁必须在当前轮 `<turn-directives>` **最前**，且禁止「引文保持原文」。
不要把语言写进冻结的 system。见 `src/i18n/directives.ts` 与
[adr/0003](adr/0003-prefix-freeze.md)。

### 划词后没有译文、也没有「解释选区」

插件沙箱里不要 `new AbortController()`。日志搜 `translate popup failed`。
Google 被拦时弹窗应显示失败原因而不是整块空白；设置里可换 DeepL / Azure / 对话模型。

### 叉掉「选中内容」后模型仍看到那段

发送不能回落到阅读器 live 选区。见
[environment.md §11](environment.md#十一叉掉选区芯片后发送仍带上选区) 和
[adr/0008](adr/0008-selection-suffix.md)。

### 浮层渲染了但看不见

检查 `data-radix-popper-content-wrapper` 的 `transform` 是否含 `-200%`。如果是，
说明 floating-ui 没能完成定位，多半是环境问题，见
[environment.md §1.3](environment.md#13-库在模块级判环境)。

## 提交约定

- commit message 用中文，说清**为什么**而不只是改了什么；踩坑类改动把根因写进去
- 涉及运行时行为的改动，在 message 里附验证输出
- 架构级决策补一份 [adr/](adr/)
