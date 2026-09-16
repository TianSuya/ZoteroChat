# 0005. frame 永不 reparent

**状态**：已采纳
**日期**：2026-09

## 背景

Zotero 每次 tab 切换会重建 item pane 的 section body。参考项目 aidea 的做法是
把已有 DOM host **搬**到新 body 里（`readerPanel.ts` 的 reparent 模式），避免重建
——这样能保住滚动位置和输入框里的半截内容。

原规划照抄了这个模式。但换成 iframe 之后前提变了：**移动 iframe 到新父节点会销毁
并重建其文档**，React 树、组件状态、进行中的流式输出全部丢失。

## 决策

不移动 frame。每个 section body 创建自己的 frame，随 body 一起销毁。

```ts
const frames = new WeakMap<HTMLElement, PanelFrame>();

onRender:  if (!frames.has(body)) { 建 frame; frames.set(body, frame); }
onDestroy: frames.get(body)?.destroy(); frames.delete(body);
```

## 理由

试图保住 frame 只有两条路，都比"让状态可恢复"更糟：

**把 frame 藏在固定容器里，切 tab 只改 display。** 要脱离 Zotero 的 section 布局
自己管定位，和高度自适应（[0006](0006-panel-auto-sizing.md)）直接冲突。

**接受重载，但把状态塞进 sessionStorage。** 多一套序列化机制，而我们本来就要把
状态放进 SQLite。

而"让状态可恢复"这件事**我们本来就要做**：M4 之后 store 是唯一真相源，消息、
草稿、流式进度都在库里。重载只是重新读一次。

## 代价

- tab 切换有一次 iframe 重载的开销（实测感知不明显，但没有量化）
- **流式进行中切 tab 会中断**。缓解：流式内容也要落库，重载后能续上或至少不丢失
  已生成部分。这一点在 M4 实现时必须验证。

## 证据

"移动 iframe 会重载文档"是 Gecko 的既有行为，**本项目没有实测**。之所以直接采信，
是因为即使它在某些情况下不重载，依赖这个行为也太脆弱——而"状态可恢复"是我们
无论如何都要做的事。
