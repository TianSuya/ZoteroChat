# Zotero 运行环境

> 这一篇是**故障目录**。每一条都对应一次真实的调试，大多数症状都不会自己报错。
> 遇到诡异问题先在这里找。

## 版本矩阵

| Zotero | Gecko | 说明 |
|---|---|---|
| 7 | Firefox 115 ESR | Tailwind v4 要求 128+，所以我们锁 v3 |
| 8 | Firefox 140 ESR | |
| 9 | Firefox 140 ESR | 本机开发用的版本 |

运行时分支用 `Zotero.platformMajorVersion`（返回 115 / 128 / 140）。

**当前只在 Gecko 140 上实测过。** Zotero 7 的兼容性靠 `target: firefox115` 和
Tailwind v3 留的余量，没有真机验证。要覆盖需要单独装一个 Zotero 7。

查本机版本：

```bash
cat /Applications/Zotero.app/Contents/Resources/platform.ini   # Milestone=140.12.0
```

---

## 一、Zotero 主窗口不是网页

这是所有问题的总根源，也是 UI 最终跑进 iframe 的原因
（[adr/0001](adr/0001-ui-in-iframe.md)）。三个具体表现：

### 1.1 bootstrap 沙箱不是 window

插件代码经 `Services.scriptloader.loadSubScript(url, ctx)` 加载。`ctx` 只作为
**裸标识符的作用域**，不是 `globalThis`。后果：

- 没有 `window`、`getComputedStyle`、`ResizeObserver` 等 DOM 全局。
- 库里的 `globalThis?.document` 取不到东西，哪怕裸写 `document` 能解析。

> React DOM 会报 `ReferenceError: window is not defined`；
> Radix 的 `usePresence` 会报 `getComputedStyle is not defined`。

### 1.2 `document.body` 是 null

主窗口的根是 XUL 的 `<window>`，不是 `<html><body>`。凡是往 body 里塞东西的
代码都会崩：

- Radix 的 `useFocusGuards` 要往 `document.body` 插焦点哨兵
- floating-ui 的祖先遍历终止于 `ownerDocument.body`

### 1.3 库在**模块级**判环境

这条最隐蔽，因为它**完全静默**。打包产物里能看到：

```js
var useLayoutEffect2 = globalThis?.document ? React.useLayoutEffect : () => {};
var isClient = typeof document !== "undefined";
```

ESM 的 import 先于导入者的函数体求值，所以任何"启动时安装垫片"的方案都晚于这行。
垫片装不上的后果不是报错，而是 **Radix 的所有布局副作用变成空函数**：组件照常渲染、
样式正常、没有任何异常，只是 anchor 永远注册不上，浮层停在
`translate(0px, -200%)`（Radix 定位完成前的初始隐藏位移）。

**排查信号**：浮层"渲染了但看不见"，且 `data-radix-popper-content-wrapper` 的
`transform` 含 `-200%`。

---

## 二、XUL 元素的坑

### 2.1 没有 `offsetHeight` / `offsetTop`

`item-pane-custom-section` 等 XUL 命名空间元素上读这些属性得到 `undefined`。

危险在于传染方式：`undefined - number` → `NaN`，而 **`NaN !== NaN` 会让"值没变就
跳过"这类守卫永远不成立**，observer 陷入无限重算。日志里 `JSON.stringify` 会把 NaN
序列化成 `null`，看起来像"没取到值"。

**用 `getBoundingClientRect()`**，两个命名空间都有效。

> Zotero 自己的 `itemPaneContainerBase.mjs` 里也有这条注释：
> `// No offsetTop property for XUL elements`，并用 rect + scrollTop 手算偏移量。

### 2.2 paneID 会被转义

注册 section 时传的 `pluginID` 里的 `@` 会被 Zotero 转义，`data-pane` 的实际值是
`zoterochat\@bowentian-zoterochat-chat`（带反斜杠）。

别去拼这个转义形式。要定位自己的 section，从自己的 iframe 反查：

```ts
frame.closest("item-pane-custom-section")
```

### 2.3 reader tab 有独立的 item pane

阅读器标签页的 item pane 在 context pane 里，是**另一个实例**。`document.querySelector
("#zotero-view-item")` 可能返回库视图那个（隐藏的），测量到完全无关的东西。

**一律从自己的元素 `closest()` 向上找**，不要全文档查询。

---

## 三、Fluent 本地化

### 3.1 值形式会冲掉宿主元素的子树

```ftl
panel-header = 对话          # ✗ 值形式
```

Fluent 会把它写进 `<collapsible-section>` 的 **textContent**，把该元素自带的
`.head`（图标 + 折叠箭头）连同我们写进 body 的内容一起替换掉。

表面上是三个独立 bug——图标不显示、折叠箭头没了、面板内容空白——实际是同一个根因。

正确写法是属性形式：

```ftl
panel-header =
    .label = 对话             # collapsible-section 读 label 属性
panel-sidenav-tooltip =
    .tooltiptext = 与这篇论文对话
```

对应 `collapsibleSection.js` 里的 `this._title.textContent = this.label`。

### 3.2 `.ftl` 有缓存，热重载不刷新

改了本地化文件必须**完整重启**开发实例。热重载看不到效果会让人误以为修复没生效。

### 3.3 `l10nArgs` 不传会变成字符串 "undefined"

Zotero 直接 `dataset.l10nArgs = l10nArgs`，不传就得到字面量 `"undefined"`——无效
JSON。显式传 `l10nArgs: "{}"`。

---

## 四、图标

Zotero 用 `background-image` + `-moz-context-properties: fill, fill-opacity, stroke,
stroke-opacity` 渲染图标，`[custom]` 规则里 `fill` 和 `stroke` 都设为
`--fill-secondary`。

所以 SVG 要用 `fill="context-fill"` + **填充路径**（用 evenodd 画出描边效果），
这是 Zotero 自己图标的写法。

**注意 SVG paint 的 fallback 是空格分隔不是逗号**：`stroke="context-stroke, currentColor"`
解析失败，图标整个不可见。

---

## 五、iframe 相关

### 5.1 `load` 事件不可靠

item pane 里的 iframe 不触发 `load`。用显式握手代替，见
[architecture.md](architecture.md#握手为什么不用-load-事件)。

### 5.2 reparent 会重载文档

移动 iframe 到新父节点会销毁并重建其文档，React 状态全丢。见
[adr/0005](adr/0005-no-frame-reparent.md)。

### 5.3 floating-ui 会遍历出 iframe

`getOverflowAncestors` 走到我们的 `<body>` 后，会顺着 `window.frameElement` 继续
爬进父级 XUL 文档，又撞上 `document.body === null`：

```js
const frameElement = getFrameElement(win);
return list.concat(..., frameElement ? getOverflowAncestors(frameElement) : []);
```

试过 `type="content"` 想靠主体隔离切断——**无效**，chrome:// 在特权父窗口里仍是
同主体，`frameElement` 照样可见。

解法是在面板自己的 window 上把 `frameElement` 覆盖成 null
（`panel-app/index.tsx`）。语义上正好是「这个面板不参与外层文档的滚动祖先链」，
既不动 Zotero 的 document 也不改三方源码，作用域只有这一个窗口。

**注意**：握手用的引用必须在覆盖**之前**捕获。

### 5.4 主题变量不跨 document 继承

CSS 自定义属性不跨越 document 边界，所以宿主主题要显式桥接：`frame.ts` 从宿主窗口
读 Zotero 变量，推进 frame，`App.tsx` 写到 `documentElement` 上。

**只推颜色值变量**。Zotero 的 `--material-border-*` 是 **border 简写**
（`1px solid rgba(...)`），当 `border-color` 用是无效的——我们的边框改从
`--fill-quinary` 派生。

### 5.5 面板文档需要显式高度

`html` / `body` / `#zc-root` 都要 `height: 100%`，否则 `h-full` 找不到确定高度的
祖先，composer 会浮在内容正下方而不是贴底。

---

## 六、item pane section 的渲染时机

`itemDetails.render()` 的顺序：

```js
box.item = item;                                   // 触发 onItemChange
if (!collapsed && !box.hidden && box.render) box.render();   // 触发 onRender
```

两个后果：

1. **`onInit` 时 item 和 tabType 可能是 undefined。** 那时别急着
   `setEnabled(false)`——一旦置为 hidden，同轮的 render 会被跳过并记为 pending，
   要等展开或下一次 item change 才补上。
2. **插件热重载后 section 不会自动重渲染。** `renderCustomSections()` 只在
   `itemDetails.render()` 里跑，而重载时 item 和 tab 都没变。开发夹具通过强制切一次
   tab 来触发（`dev/seed.ts`）。

---

## 七、构建工具链

### 7.1 jiti 版本冲突

脚手架依赖的 `c12@4` 需要 jiti v2 的 `createJiti`，但 Tailwind v3 会把 jiti@1 提升
到根目录顶掉它。症状：`TypeError: createJiti is not a function`。

根上显式声明 `jiti@^2` 即可，npm 会把 v1 嵌套到 tailwindcss 下。

### 7.2 Tailwind v3 会 purge `@layer` 内基于 class 的规则

设计 token 如果写在 `@layer base` 里，content 扫描不到对应 class 就会被清掉。
**写在 layer 外面**，Tailwind 原样透传。

### 7.3 `createZToolkit()` 不能读 `addon` 全局

它在 `new Addon()` 构造期间被调用，那时 `addon` 还没赋值。直接 `import { config }`。
