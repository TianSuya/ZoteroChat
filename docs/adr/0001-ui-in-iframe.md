# 0001. UI 跑在 iframe 而非 Shadow DOM

**状态**：已采纳
**日期**：2026-09

## 背景

面板要用 React + Radix + Tailwind + assistant-ui。原计划用 **Shadow DOM 全隔离**：
给 host 挂 shadowRoot、`adoptedStyleSheets` 注入 Tailwind、Radix 浮层通过一个
`PortalContainerContext` 统一 portal 到 shadow 内。

理由当时很充分：样式双向零泄漏，而且 CSS 自定义属性**能**穿透 shadow 边界，
所以"跟随 Zotero 主题"不需要任何桥接代码。

实现后连续撞上六类失败：

| 症状 | 根因 |
|---|---|
| `window is not defined` | bootstrap 沙箱不是 window |
| `getComputedStyle is not defined` | 同上 |
| Radix 读 `globalThis?.document` 得到 undefined | `loadSubScript` 的 scope 对象不是 `globalThis` |
| `useFocusGuards` 崩在 `document.body is null` | 主窗口是 XUL 根，没有 body |
| `useLayoutEffect` 静默退化成空函数 | 库在**模块级**判环境，早于任何垫片安装 |
| floating-ui 祖先遍历崩溃 | 遍历终止于 `ownerDocument.body`，仍是 null |

每一个都补了垫片，每一个之后又冒出下一个。

## 决策

面板 UI 渲染在 item pane section 内的一个 iframe 里，加载
`chrome://zoterochat/content/panel.xhtml`——一个真实的 HTML 文档。

## 理由

前五条失败是同一个根因的不同切面：**整个 Web UI 生态默认自己跑在正常的 HTML 文档
里，而 Zotero 主窗口不是**。垫片是在模拟一个浏览器环境，iframe 直接给一个真的。

决定性的那条是第五个。打包产物里能看到：

```js
var useLayoutEffect2 = globalThis?.document ? React.useLayoutEffect : () => {};
```

ESM 的 import 先于导入者的函数体求值，所以任何"启动时安装垫片"的方案都晚于这行。
装不上的后果不是报错，而是 Radix 的所有布局副作用变成空函数——组件照常渲染、
样式正常、无任何异常，只是 anchor 永远注册不上，浮层停在 `translate(0, -200%)`。

**这类失败没有边界**：今天是 floating-ui，明天可能是任意一个在模块级判环境的库。
垫片方案永远在追着补。

### 被放弃的选项

**继续补垫片。** 可行但无止境。而且最后一条（floating-ui 的祖先遍历）要修就得给
Zotero 自己的 document 对象加 `body` 访问器——改宿主全局对象，风险远大于收益。

**`type="content"` 做主体隔离。** 试过，无效：chrome:// 在特权父窗口里仍是同主体，
`window.frameElement` 照样可见，floating-ui 照样爬出去。

**改用 `<browser type="content">` + 真正的内容主体。** 能从根上切断，但 bridge 要
退化成 postMessage，且需要更多验证。留作后备——如果将来需要真正的权限隔离
（面板渲染 LLM 输出和论文正文，降权本身有安全价值），这是升级路径。

## 代价

三件事从"免费"变成"要写"：

1. **主题跟随要显式桥接。** 自定义属性不跨 document 继承。
2. **不能 reparent。** 见 [0005](0005-no-frame-reparent.md)。
3. **高度要自己算。** 见 [0006](0006-panel-auto-sizing.md)。

另外 floating-ui 仍会顺着 `window.frameElement` 爬出 iframe，需要在面板自己的
window 上把 `frameElement` 覆盖成 null。这是唯一残留的环境 hack，但它作用域只有
一个窗口，不动 Zotero 也不动三方源码。

## 意外收获

iframe 边界可以**编码进类型系统**：两份 tsconfig 分别用 zotero-types 的 `sandbox`
和 `xhtml` entry，在插件侧误用 `document` 直接编译失败。Shadow DOM 方案里两边是同
一个环境，没法这样区分。

## 证据

`dev/radixProbe.tsx`，四类浮层：

| | portaled | positioned | anchored | transform |
|---|---|---|---|---|
| tooltip | ✓ | ✓ | ✓ | `translate(0px, 146px)` |
| dropdown-menu | ✓ | ✓ | ✓ | `translate(0px, 70px)` |
| popover | ✓ | ✓ | ✓ | `translate(96px, 138px)` |
| cmdk | ✓ | ✓ | ✓ | `translate(64px, 49px)` |

`inBody: 4`、`escapedToDocument: 0`。

对照：Shadow DOM 方案最好的一次是 portaled + positioned + styled 但
**`anchored: false`**，transform 恒为 `translate(0px, -200%)`。
