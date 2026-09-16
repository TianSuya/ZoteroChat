# 开发笔记

## 运行

```bash
npm install
npm start        # 启动独立开发实例（独立 profile + 独立数据目录，不碰你的真实库）
npm run build    # 产出 .scaffold/build/*.xpi
npm run typecheck
```

`.env` 指向一个一次性的 Zotero profile 和数据目录。首次启动会自动把 `fixtures/attention.pdf`
导入这个空库并打开阅读器（见 `src/dev/seed.ts`，production 构建时整个模块会被 esbuild 剔除）。

## 平台版本

| Zotero | Gecko | 备注 |
|---|---|---|
| 7 | Firefox 115 ESR | Tailwind v4 需要 FF128+，所以锁 v3 |
| 8 | Firefox 140 ESR | |
| 9 | Firefox 140 ESR | 本机开发用的版本（9.0.6） |

用 `Zotero.platformMajorVersion` 做运行时分支。**注意本地只能验到 Gecko 140**，
Zotero 7 的兼容性需要单独装旧版实测。

## 架构：为什么 UI 跑在 iframe 里

`register.ts` 在 item pane section 里放一个指向 `chrome://zoterochat/content/panel.xhtml`
的 iframe，React / Radix / Tailwind 全部跑在那个**真实 HTML 文档**里。

一开始走的是 Shadow DOM + DOM 全局垫片，撞了一连串墙，全是同一个模式——
**整个 Web UI 生态默认自己在一个正常的 HTML 文档里，而 Zotero 主窗口不是**：

| 失败 | 根因 |
|---|---|
| `window is not defined` | bootstrap 沙箱不是 window |
| `getComputedStyle is not defined` | 同上 |
| Radix 读 `globalThis?.document` 得到 undefined | `loadSubScript` 的 scope 对象不是 `globalThis` |
| `useFocusGuards` 崩在 `document.body is null` | 主窗口是 XUL 根（`<window>`），没有 body |
| `useLayoutEffect` 静默退化成空函数 | 库在**模块级**判环境，早于任何垫片安装 |
| floating-ui 祖先遍历崩溃 | 遍历终止于 `ownerDocument.body`，仍是 null |

垫片这条路每前进一步都在发现新的环境假设，且没有边界。iframe 一次性消掉整类问题。

### iframe 方案里仍需处理的三件事

1. **主题跟随要显式桥接。** 自定义属性不跨 document 继承，`frame.ts` 从宿主窗口读
   Zotero 的变量再推进 frame。只推**颜色值**变量——`--material-border-*` 是 border
   简写（`1px solid rgba(...)`），当 `border-color` 用是无效的。
2. **不 reparent。** 移动 iframe 会重新加载其文档，React 状态会丢。每个 section body
   一个 frame，值得保留的状态放 store 而不是 DOM。
3. **切断向外的滚动祖先链。** floating-ui 走到 `<body>` 后会顺着 `window.frameElement`
   继续走进父级 XUL 文档，又撞上 null body。面板在自己的 window 上把 `frameElement`
   覆盖成 null（`panel-app/index.tsx`）——既不动 Zotero 的 document 也不改三方源码。
   握手用的引用要在覆盖**之前**捕获。

### 边界的类型建模

两份 tsconfig 把 iframe 边界编码进类型系统：

- `tsconfig.plugin.json` → `zotero-types/entries/sandbox`（无 DOM lib）
- `tsconfig.panel.json` → `zotero-types/entries/xhtml`（有 DOM lib）

在插件侧误用 `document` 会直接编译失败。

## 其他踩过的坑

**Fluent 的值形式会冲掉宿主元素的子树。** `panel-header = 对话` 这种值形式会被 Fluent
写进 `<collapsible-section>` 的 textContent，把它自带的 `.head`（图标 + 折叠箭头）连同
我们写进 body 的内容一起替换。section header 必须写成 `.label` 属性形式，sidenav 必须
写成 `.tooltiptext`——对应 `collapsibleSection.js` 里的 `this._title.textContent = this.label`。

**Fluent 文件有缓存，热重载不刷新。** 改了 `.ftl` 要完整重启开发实例才生效。

**图标要用 Zotero 的 context 约定。** `fill="context-fill"` + 填充路径（evenodd 画描边
效果）。SVG paint 的 fallback 是空格分隔，写成 `stroke="context-stroke, currentColor"`
会解析失败导致图标不可见。

**iframe 的 `load` 事件在 item pane 里不可靠。** 改用显式握手：宿主在插入前把
`__zcOnReady` 挂到 frame 元素上，面板 bundle 就绪后回调。它对应的也是更准确的时机
——"bundle 就绪"而非"文档解析完"。

**`createZToolkit()` 不能读 `addon` 全局。** 它在 `new Addon()` 构造期间被调用，
那时 `addon` 还没赋值，要直接 import `config`。

**jiti 版本冲突。** `c12@4`（脚手架依赖）需要 jiti v2 的 `createJiti`，但 Tailwind v3
会把 jiti@1 提升到根目录。根上显式声明 `jiti@^2` 即可。

**Tailwind v3 会 purge `@layer` 内基于 class 的规则。** 设计 token 写在 layer 外面，
Tailwind 原样透传，不参与 purge。

**section 的渲染时机。** `itemDetails.render()` 的顺序是 `box.item = item`（触发
onItemChange）→ `if (!collapsed && !box.hidden && box.render) box.render()`。
插件热重载后 section 不会自动重渲染——`renderCustomSections()` 只在 `itemDetails.render()`
里跑，而 item 和 tab 都没变。开发夹具会强制切一次 tab 来触发。
