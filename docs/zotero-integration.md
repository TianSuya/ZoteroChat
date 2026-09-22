# Zotero 集成

## Section 注册

[`src/panel/register.ts`](../src/panel/register.ts)，用 Zotero 7 的官方 plugin API：

```ts
Zotero.ItemPaneManager.registerSection({
  paneID,
  pluginID,
  header: { l10nID, l10nArgs: "{}", icon }, // 16px
  sidenav: { l10nID, l10nArgs: "{}", icon }, // 20px
  onInit,
  onItemChange,
  onRender,
  onDestroy,
});
```

不 monkey-patch 任何 Zotero 内部实现——这是 7→8→9 能一份代码通吃的前提。

### 启用条件

sidenav 图标**始终显示**。不要在 `onInit` 里 `setEnabled(false)`：那时 `item` /
`tabType` 经常还是空的，图标会被藏起来且同轮 render 被跳过（见
[environment.md §6](environment.md#六item-pane-section-的渲染时机)）。

真正开聊仍要求在 **reader 里打开 PDF**。阅读器有时把父条目而不是附件传给
section，要用 `getPdfItem()` 解析出 PDF。库视图点开图标会看到「打开一个 PDF」
的空状态。

### 生命周期顺序

`itemDetails.render()` 内部：

```js
box.item = item; // → onItemChange
if (!collapsed && !box.hidden && box.render) box.render(); // → onRender
```

两个必须知道的后果，见
[environment.md §6](environment.md#六item-pane-section-的渲染时机)。

### frame 的生命周期

**每个 section body 一个 frame，永不移动**（[adr/0005](adr/0005-no-frame-reparent.md)）。
同一 body 换 PDF 时**拆掉重建**，不 reparent。

```ts
const frames = new WeakMap<HTMLElement, { frame: PanelFrame; itemID: number }>();

onRender:
  无 PDF           → destroy + 空状态
  已有且 itemID 相同 → return
  否则             → destroy 旧 frame，建新 frame，replaceChildren，attached()
onDestroy: frames.get(body)?.frame.destroy(); frames.delete(body);
```

Zotero 每个 item pane 实例给一个新 body，所以这个粒度是自然的。会话按 `itemID`
存在插件内存里（`llm/session.ts`）；换附件等于换会话。

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
doc.defaultView?.MozXULElement?.insertFTLIfNeeded("zoterochat-panel.ftl");
```

## 图标

源文件 `assets/logo.png`（方标），构建进 `addon/content/icons/`。GitHub README
用横向 `assets/logo-h.png`，不进 XPI。

| 文件                                | 用途                            |
| ----------------------------------- | ------------------------------- |
| `icon-48.png` / `icon-96.png`       | 插件管理器、设置页              |
| `section-16.png` / `section-20.png` | item pane header / 右侧 sidenav |

引用走 chrome URL（`bootstrap.js` 里注册的）：

```
chrome://zoterochat/content/icons/section-20.png
```

## 首选项

`addon/prefs.js`，构建时 `__prefsPrefix__` 会替换成
`extensions.zotero.zoterochat`。

| key                         | 默认                       | 用途                                                   |
| --------------------------- | -------------------------- | ------------------------------------------------------ |
| `apiBaseUrl`                | `https://api.deepseek.com` | LLM 端点                                               |
| `apiKey`                    | `""`                       | API key（设置页填写，开发期可从 `devApiKeyFile` 预填） |
| `model`                     | `deepseek-flash`           | 模型名（DeepSeek-V4.1-Flash）                          |
| `replyLanguage`             | `zh-CN`                    | 回答与快捷提问的优先语言；`auto` 跟随当前问题          |
| `fontSize`                  | `14`                       | 对话窗口正文字号（12–18）                              |
| `devApiKeyFile`             | `""`                       | 开发期 key 文件路径，仅在 apiKey 为空时回退            |
| `followZoteroTheme`         | `true`                     | 主题跟随                                               |
| `showSelectionPopupButtons` | `true`                     | 划词弹窗按钮                                           |
| `showCostBar`               | `true`                     | 成本条                                                 |
| `debugDumpPayload`          | `false`                    | dump 请求体用于前缀 diff                               |
| `devSeedPDF`                | `""`                       | 开发夹具 PDF 路径                                      |
| `devShowRadixProbe`         | `false`                    | 探针开关                                               |
| `devShowAssistantProbe`     | `false`                    | 探针开关                                               |

设置页在 **编辑 → 设置 → ZoteroChat**（侧栏齿轮也会打开）。视觉与对话面板同一套
token（`addon/content/preferences.css`）。API key 存在当前 profile 的 prefs 里，
只发往用户填写的 Base URL。

设置页脚本可能早于片段 DOM，必须 `vbox onload` + 按钮 `onclick`，见
[environment.md §8](environment.md#八设置页脚本早于片段-dom)。`<select>` 去掉原生
箭头、自绘 chevron，见 [environment.md §10](environment.md#十设置页-select-原生箭头会被圆角裁掉)。
「应用」会 `flush` 全部字段并 `notifyPrefsApplied`；观察 `fontSize` /
`replyLanguage` 时 `registerObserver` 必须传 `global: true`，与
`Zotero.Prefs.set(..., true)` 同一条分支。

## 已落地的集成

### 全文提取

`Zotero.PDFWorker.getFullText(item.id)` → `{ text }`，经 `normalize()` 后写入冻结前缀。

**不返回分页信息**，所以页码只能来自划词的 `pageIndex`；「回答里引用页码」在 v1
降级为引用章节标题，prompt 里明确禁止编造页码。

### 设置页

`Zotero.PreferencePanes.register`，片段在 `addon/content/preferences.xhtml`。
脚本可能早于 DOM 插入，测试按钮必须用 `onclick`，不能只在模块顶层 `addEventListener`。

### 划词

`Zotero.Reader.registerEventListener("renderTextSelectionPopup")`
（`src/reader/selection.ts`）。

- 划词后自动写入当前附件的选区，composer 出现「选中内容」芯片。
- 发给模型的是当前轮 `<selection page="N">USER_SELECTED_PASSAGE…`，**不改冻结前缀**。
- 阅读器 popup 上方显示选段译文（默认 Google，可在设置里换 DeepL / Google Cloud /
  Azure / 对话模型）。目标语言跟「优先语言」。样式写在 reader 文档里，不透明底。
- 同一弹窗有「解释选区」：打开对话并把该段当作本轮选区提问。按钮样式写在
  popup 所在的 reader 文档里（`padding: 6px 12px` / `min-height: 28px`），
  **不在**面板 frame 内。
- 叉掉芯片会 `dismissSelection`：记下 fingerprint，live 高亮仍在 PDF 里也不再发送。
  发送真相是芯片，见 [adr/0008](adr/0008-selection-suffix.md)。

`showSelectionPopupButtons` 可关掉 popup 按钮；自动芯片不受影响。

### 持久化

独立 sqlite：`{dataDir}/zoterochat.sqlite`，**必须用绝对路径**打开
（`new Zotero.DBConnection(absPath)`），这样 `_externalDB = true`。
只传库名会被当成内部库，WAL 残留会触发「正在检查数据库完整性」并卡很久。
见 [environment.md §14](environment.md#十四打开-pdf-卡在正在检查数据库完整性)。

不写 `zotero.sqlite`。消息只 INSERT；「新对话」把当前会话 `archived=1`。
实现见 `src/store/db.ts` 与 [adr/0004](adr/0004-append-only-store.md)。
