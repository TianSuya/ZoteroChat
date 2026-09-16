# Zotero 集成

## Section 注册

[`src/panel/register.ts`](../src/panel/register.ts)，用 Zotero 7 的官方 plugin API：

```ts
Zotero.ItemPaneManager.registerSection({
  paneID, pluginID,
  header:  { l10nID, l10nArgs: "{}", icon },   // 16px
  sidenav: { l10nID, l10nArgs: "{}", icon },   // 20px
  onInit, onItemChange, onRender, onDestroy,
})
```

不 monkey-patch 任何 Zotero 内部实现——这是 7→8→9 能一份代码通吃的前提。

### 启用条件

v1 只在 **reader tab 的 PDF 附件**上启用：

```ts
tabType === "reader" && item?.isPDFAttachment?.()
```

整个设计建立在「一篇打开的 PDF = 一个会话」上，库视图没有对应概念。

### 生命周期顺序

`itemDetails.render()` 内部：

```js
box.item = item;                                            // → onItemChange
if (!collapsed && !box.hidden && box.render) box.render();  // → onRender
```

两个必须知道的后果，见
[environment.md §6](environment.md#六item-pane-section-的渲染时机)。

### frame 的生命周期

**每个 section body 一个 frame，永不移动**（[adr/0005](adr/0005-no-frame-reparent.md)）。

```ts
const frames = new WeakMap<HTMLElement, PanelFrame>();

onRender:  if (!frames.has(body)) { 建 frame; frames.set(body, frame); }
onDestroy: frames.get(body)?.destroy(); frames.delete(body);
```

Zotero 每个 item pane 实例给一个新 body，所以这个粒度是自然的。

## 本地化

`addon/locale/{en-US,zh-CN}/panel.ftl`。构建时脚手架会加命名空间前缀：
文件名 `panel.ftl` → `zoterochat-panel.ftl`，消息 id `panel-header` →
`zoterochat-panel-header`。

**必须用属性形式**，值形式会冲掉宿主元素的子树：

```ftl
panel-header =
    .label = 对话
panel-sidenav-tooltip =
    .tooltiptext = 与这篇论文对话
```

原因见 [environment.md §3.1](environment.md#31-值形式会冲掉宿主元素的子树)。

FTL 要先注入文档才能解析：

```ts
doc.defaultView?.MozXULElement?.insertFTLIfNeeded("zoterochat-panel.ftl")
```

## 图标

`addon/content/icons/section-16.svg` / `section-20.svg`，用 Zotero 的 context 约定：
`fill="context-fill"` + evenodd 填充路径。详见
[environment.md §4](environment.md#四图标)。

引用走 chrome URL（`bootstrap.js` 里注册的）：

```
chrome://zoterochat/content/icons/section-16.svg
```

## 首选项

`addon/prefs.js`，构建时 `__prefsPrefix__` 会替换成
`extensions.zotero.zoterochat`。

| key | 默认 | 用途 |
|---|---|---|
| `apiBaseUrl` | `https://api.openai.com/v1` | LLM 端点 |
| `model` | `""` | 模型名 |
| `followZoteroTheme` | `true` | 主题跟随 |
| `showSelectionPopupButtons` | `true` | 划词弹窗按钮 |
| `showCostBar` | `true` | 成本条 |
| `debugDumpPayload` | `false` | dump 请求体用于前缀 diff |
| `devSeedPDF` | `""` | 开发夹具 PDF 路径 |
| `devShowRadixProbe` | `false` | 探针开关 |
| `devShowAssistantProbe` | `false` | 探针开关 |

API key **不放 prefs**（明文、会被配置导出带走），计划用 `Services.logins`。

## 计划中的集成点

### 全文提取

`Zotero.PDFWorker.getFullText(item.id)` → `{ text, ... }`。

**不返回分页信息**，所以页码只能来自划词的 `pageIndex`；「回答里引用页码」在 v1
降级为引用章节标题，prompt 里明确禁止编造页码。

### 划词

```ts
Zotero.Reader.registerEventListener("renderTextSelectionPopup", handler, pluginID)
```

handler 拿 `{ reader, doc, params, append }`，文本在 `params.annotation.text`，
页码在 `params.annotation.position.pageIndex`。

注意 popup 在 reader 的 iframe 文档里，**不在我们的面板 frame 内**，样式要单独写。

面板内兜底取选区需要遍历多层 iframe（`reader._iframeWindow.document` →
`_internalReader._primaryView._iframe.contentDocument`），可参考 aidea 的
`readerSelection.ts`。

### 持久化

计划用**独立 sqlite 文件**（`new Zotero.DBConnection("zoterochat")`），不写
`zotero.sqlite`。主库会被 Zotero 的备份、迁移、完整性检查触及，风险不值得。

表结构见 [roadmap.md](roadmap.md)。
