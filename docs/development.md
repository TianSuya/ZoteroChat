# 开发指南

## 快速开始

```bash
npm install
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

夹具 PDF 放在 `fixtures/`（已 gitignore）。任意开放获取的论文都行：

```bash
curl -sL -o fixtures/attention.pdf https://arxiv.org/pdf/1706.03762v7
```

## 命令

| 命令 | 作用 |
|---|---|
| `npm start` | 开发实例 + 热重载 |
| `npm run build` | 类型检查 + 产出 `.scaffold/build/*.xpi` |
| `npm run typecheck` | `tsc -b`，同时检查插件侧与面板侧 |
| `npm run lint` / `lint:fix` | eslint + prettier |
| `npm test` | vitest |

## 构建管线

两个 esbuild entry，对应架构上的两侧：

| entry | 产物 | target | 说明 |
|---|---|---|---|
| `src/index.ts` | `content/scripts/zoterochat.js` | firefox115 | 插件侧，无 React |
| `src/panel-app/index.tsx` | `content/scripts/panel.js` | firefox115 | 面板侧，React + Radix + Tailwind |

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

| 探针 | pref | 验证什么 |
|---|---|---|
| `dev/radixProbe.tsx` | `devShowRadixProbe` | tooltip / dropdown / popover / cmdk 四类浮层在 iframe 内 portal、定位、锚定、取到样式 |
| `dev/assistantProbe.tsx` | `devShowAssistantProbe` | assistant-ui 运行时渲染、流式、capability gating |
| `dev/checkSizing.ts` | 总是运行（dev） | 高度自适应在「静止」与「滚到顶」两种状态下都贴底 |

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

### 面板没出现

按顺序确认：

1. 当前是 reader tab 吗？（v1 只在 reader 启用）
2. 打开的是 PDF 附件吗？（`item.isPDFAttachment()`）
3. section 是展开的吗？折叠时 Zotero 会跳过 render
4. 日志里有 `panel frame created` 吗？

### 浮层渲染了但看不见

检查 `data-radix-popper-content-wrapper` 的 `transform` 是否含 `-200%`。如果是，
说明 floating-ui 没能完成定位，多半是环境问题，见
[environment.md §1.3](environment.md#13-库在模块级判环境)。

## 提交约定

- commit message 用中文，说清**为什么**而不只是改了什么；踩坑类改动把根因写进去
- 涉及运行时行为的改动，在 message 里附验证输出
- 架构级决策补一份 [adr/](adr/)
