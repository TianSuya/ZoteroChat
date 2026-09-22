# Zotero 运行环境

> 这一篇是**故障目录**。每一条都对应一次真实的调试，大多数症状都不会自己报错。
> 遇到诡异问题先在这里找。

## 版本矩阵

| Zotero | Gecko           | 说明                                 |
| ------ | --------------- | ------------------------------------ |
| 7      | Firefox 115 ESR | Tailwind v4 要求 128+，所以我们锁 v3 |
| 8      | Firefox 140 ESR |                                      |
| 9      | Firefox 140 ESR | 本机开发用的版本                     |

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
frame.closest("item-pane-custom-section");
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

当前插件图标是 **PNG**（`assets/logo.png` → `addon/content/icons/` 的 16/20/48/96）。
Zotero 的 sidenav / header 用 `background-image` 画这些文件，不走 SVG `context-fill`。

如果以后改回 SVG，Zotero 用 `background-image` + `-moz-context-properties: fill,
fill-opacity, stroke, stroke-opacity` 渲染，`[custom]` 规则里 `fill` 和 `stroke`
都设为 `--fill-secondary`。那时 SVG 要用 `fill="context-fill"` + **填充路径**
（用 evenodd 画出描边效果），这是 Zotero 自己图标的写法。

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
box.item = item; // 触发 onItemChange
if (!collapsed && !box.hidden && box.render) box.render(); // 触发 onRender
```

两个后果：

1. **`onInit` 时 item 和 tabType 可能是 undefined。** 那时别急着
   `setEnabled(false)`——一旦置为 hidden，同轮的 render 会被跳过并记为 pending，
   要等展开或下一次 item change 才补上。XPI 安装后 sidenav 图标会整条消失，
   看起来像「插件没装上」。v1 因此**始终 `setEnabled(true)`**：库视图点开是
   「打开一个 PDF」空状态，真正开聊仍要 reader 里的 PDF。
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

---

## 八、设置页脚本早于片段 DOM

`Zotero.PreferencePanes.register({ scripts })` 会在**窗体注册 pane 时**加载
`preferences.js`，这时 `addon/content/preferences.xhtml` 片段**还没插进文档**。

症状：打开「编辑 → 设置 → ZoteroChat」，点「测试连接」毫无反应。日志里是
`missing #zc-api-base-url`。不是按钮没绑上，是 `addEventListener` 跑在空文档上。

解法（两道，缺一不可）：

1. 根节点 `<vbox onload="ZoteroChat_Preferences.init()">`——片段插入后再绑字段。
2. 测试按钮 `onclick="ZoteroChat_Preferences.test()"`——即使用户点得比 init 还早，
   点击仍走得到。不要只在模块顶层 `getElementById` + `addEventListener`。

API key 输入用原生 `type="password"`，系统自带眼睛，不要再叠一个 Show。

---

## 九、XHTML 面板不能 `innerHTML` 灌 HTML / MathML

对话面板是 `chrome://zoterochat/content/panel.xhtml`，文档类型是 **XHTML**。
`element.innerHTML = …` 走 **XML 解析器**。KaTeX 产出的 MathML 会触发：

```
InvalidCharacterError: An invalid or illegal string was specified
```

整块面板被 `ErrorBoundary` 卸掉，看起来像聊天崩了。常见触发：`<math>` 命名空间、
`<annotation>` 里未转义的 `&` / `<`。

解法见 [adr/0007](adr/0007-xhtml-html-inject.md)：`DOMParser("text/html")` +
`importNode`，注入前剥掉 TeX `<annotation>`。实现在 `src/ui/markdown/setHtml.ts`。

### 9.1 `importNode` 不移走源节点

`importNode` **拷贝**，不 detach。下面这种循环会无限克隆，实测吃掉 **70GB+** 内存、
界面冻死：

```ts
while (body.firstChild) {
  frag.appendChild(dest.importNode(body.firstChild, true));
}
```

必须先固定子节点列表：

```ts
for (const node of Array.from(parsed.body.childNodes)) {
  frag.appendChild(dest.importNode(node, true));
}
```

流式输出时 markdown+KaTeX 约 48ms 节流，避免半开的 `$$` 每个字符都重解析。

---

## 十、设置页 `<select>` 原生箭头会被圆角裁掉

`.zc-input` 有 `border-radius: 4px` 和有限的右侧内边距。macOS / Gecko 的原生
下拉箭头贴在 padding 边缘，会被圆角切掉一块——「优先语言」「字体大小」都中招。

解法：`appearance: none` + `-moz-appearance: none`，自绘 chevron，
`padding-right: 28px`，箭头放在 `right 8px`。见 `addon/content/preferences.css`。

---

## 十一、叉掉选区芯片后发送仍带上选区

划词后 composer 上方出现「选中内容」芯片。用户叉掉芯片，期望这一轮不再把该段
发给模型。早期实现仍会带上，因为发送路径有两层回落：

1. 面板 `useThreadRuntime` 在芯片为 `null` 时回落到 `bridge.getSelection()`。
2. 插件 `getSelection()` 会从阅读器 iframe **live 再读**当前高亮
   （`liveTextFromReader`）。PDF 里的高亮并没有因为叉芯片而消失。

发送真相必须是**芯片状态**，不是阅读器里还亮着的字。

解法：

- 叉掉时面板 `commitSelection(null)`，并调用 `bridge.dismissSelection()`。
- `dismissSelection(itemID)` 记下该段的 fingerprint，放进 `omitted`；
  `getSelection()` 撞上同一 fingerprint 就返回 `null`，直到下一次
  `renderTextSelectionPopup` 或点「解释选区」。
- 发送只读 `selectionRef.current`，**禁止** `getSelection() ?? bridge.getSelection()`。

见 [adr/0008](adr/0008-selection-suffix.md)。

---

## 十二、划词弹窗整块消失（译文和「解释选区」一起没了）

`renderTextSelectionPopup` 的回调跑在**插件 bootstrap 沙箱**里。沙箱没有完整 DOM 全局。
在这里 `new AbortController()` 会直接抛错，后面的 `event.append` 根本跑不到——
于是译文框和「解释选区」按钮一起消失，阅读器只剩 Zotero 自己的颜色条。

解法：

- `AbortController` 从**主窗口**取：`(Zotero.getMainWindow() as any).AbortController`。
- 先造好「解释选区」按钮；译文框放进 `try`。失败只记日志，按钮仍 `append`。
- `translateSelection` 的 Promise 必须 `.catch`，避免未处理拒绝。
- `fetch` 仍走主窗口（与 Chat Completions 相同）。

成熟做法（对照常见 PDF 翻译插件）：译文用 **textarea**（`resize: both`，记住宽高），
不要用不可缩放的 `div`。指针事件在 textarea 上 `stopPropagation`，避免拖拽时弹窗被关掉。

---

## 十三、Tooltip / 弹出层透出正文

Radix 的 Tooltip、Popover 默认 portal 到 iframe 的 `document.body`，在 `#zc-root` **外面**。
`--zc-surface-raised` 只写在 `.zc-root` 上时，浮层的 `var(--zc-surface-raised)` 是空的，
背景等于没涂，hover 再用半透明的 `--fill-quinary`，底下的字会叠上来。

解法：在 `html` / `html[data-zc-theme="dark"]` 上也定义同一套 token；浮层加
`.zc-portal.zc-float`，hover 只调不透明底的亮度，不要换成半透明 fill。划词条
`.zc-ask-aside-chip` 同一原则。
