# 0002. 锁 Tailwind v3

**状态**：已采纳
**日期**：2026-09

## 背景

目标是同时支持 Zotero 7、8、9。它们的 Gecko 版本不同：

| Zotero | Gecko           |
| ------ | --------------- |
| 7      | Firefox 115 ESR |
| 8      | Firefox 140 ESR |
| 9      | Firefox 140 ESR |

Tailwind v4 官方要求 Safari 16.4+ / Chrome 111+ / **Firefox 128+**，主要卡在
`@property`（Firefox 128 才支持），v4 用它给 `--tw-*` 系列变量设默认值——
transform、gradient、shadow、ring 都依赖。

## 决策

锁 Tailwind v3，配 shadcn/ui 的 v3 分支与 React 18。

## 理由

在 Zotero 7 上放弃 v4 的取舍很直接：v4 带来的是开发体验（CSS-first 配置、
`@theme`、OKLCH），不是能力。而我们的设计语言（Notion 式克制：小圆角、无阴影、
中性色阶）用 v3 完全够。

反过来，用 v4 就得放弃 Zotero 7 的用户——那是实打实的功能损失。

## 代价

- 配色用 HSL 而非 OKLCH
- 需要 `tailwind.config.js`（v4 可以 CSS-first）
- shadcn 新组件默认是 v4 + React 19 的，**不能直接 `npx shadcn add`**，要拿进来改
- `tailwindcss-animate` 而非 `tw-animate-css`

另外 v3 依赖 jiti@1，会和脚手架的 `c12@4` 需要的 jiti v2 冲突，根上要显式声明
`jiti@^2`（见 [environment.md §7.1](../environment.md#71-jiti-版本冲突)）。

## 重新评估的条件

如果 Zotero 7 的用户占比降到可以忽略，或项目决定只支持 8+，可以迁到 v4。
届时 `target` 也能从 `firefox115` 提到 `firefox140`。
