# 0008. 选区只属于当前轮，芯片是发送真相

**状态**：已采纳
**日期**：2026-09

## 背景

用户划词后希望模型「先看这段」。选区每划一次都变，如果写进冻结前缀，
[0003](0003-prefix-freeze.md) 的缓存不变量立刻作废。

同时有两条产品要求：

1. 划词后**自动**带上当前高亮，并在对话里用「选中内容」标注，不必先点按钮。
2. 阅读器 popup 仍保留「解释选区」，一点就打开侧栏并对这段提问。

又出现过一个真实 bug：用户叉掉 composer 上的芯片，界面没了选区，发送却仍把
PDF 里还亮着的字塞进 `<selection>`。

## 决策

选区是**当前轮后缀**，永远不进 `[0][1][2]`。

```
[n+1]  <turn-directives>
       可选 <selection page="N">USER_SELECTED_PASSAGE …</selection>
       <question>
```

发送时的选区以**面板芯片**为准：

- 划词 / 「解释选区」→ 芯片出现，本轮带上。
- 叉掉芯片 → `commitSelection(null)` + `dismissSelection(itemID)`。
- `dismissSelection` 记下 fingerprint；`getSelection()` 撞上同一高亮就返回
  `null`，直到下一次 `renderTextSelectionPopup`。
- `useThreadRuntime` 只读 `selectionRef`，禁止 `?? bridge.getSelection()`。

用户消息用 `encodeUserContent` 把同一段渲染成可见的「选中内容」块，避免只有
模型看得见。

## 理由

**为什么不进前缀。** 高亮随手变。冻进去等于每划一次就 miss 一次全文缓存。

**为什么自动带上，而不是只做 popup 按钮。** 用户要的是「我划了就是在问这段」；
按钮是加速项，不是唯一入口。

**为什么芯片是真相，而不是阅读器 live 选区。** PDF 高亮不会因为叉芯片而消失。
`liveTextFromReader` 再读一次，等于把用户刚丢掉的上下文偷回去。fork 阅读器
内部 iframe 取选区只适合**发现**新划词，不适合覆盖用户已经 dismiss 的决定。

### 被放弃的选项

- **把选区写进 system / paper block**：缓存全废。
- **发送时 `chip ?? bridge.getSelection()`**：叉掉芯片仍带上。实测如此。
- **只做 popup、不自动芯片**：少一次标注，也更容易漏带。
- **叉芯片时清掉 PDF 高亮**：越权，阅读器选区不是我们的。

## 代价

- 插件要维护 `omitted` fingerprint，而不是「map 里没有就算没有」。
- 面板和插件各有一份选区状态，必须在 dismiss 时两边一起清。
- 用户重新划**同一段**字才会再次附上；仅保持旧高亮不够。

## 证据

- 叉芯片后若走 `getSelection() ?? bridge.getSelection()`，请求体仍含
  `<selection>`（阅读器高亮还在）。
- `dismissSelection` + 芯片 ref 之后，同一高亮不再进入
  `buildCurrentUserMessage`，直到新的 `renderTextSelectionPopup`。
- popup 按钮在 reader 文档里，不在面板 frame；样式必须 inline，不能复用
  Tailwind。过小的 padding 会让字贴边（已改为 `6px 12px` / `min-height: 28px`）。

排查写法见 [environment.md §11](../environment.md#十一叉掉选区芯片后发送仍带上选区)。
