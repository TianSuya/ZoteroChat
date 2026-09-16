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

用 `Zotero.platformMajorVersion` 做运行时分支。

## 踩过的坑

**Fluent 的值形式会冲掉宿主元素的子树。**
`panel-header = 对话` 这种值形式会被 Fluent 写进 `<collapsible-section>` 的 textContent，
把它自带的 `.head`（图标 + 折叠箭头）连同我们 `onRender` 写进 body 的内容一起替换掉。
section header 必须写成 `.label` 属性形式，sidenav 必须写成 `.tooltiptext`——
对应 `collapsibleSection.js` 里的 `this._title.textContent = this.label`。

**Fluent 文件有缓存，热重载不刷新。** 改了 `.ftl` 要完整重启开发实例才生效。

**图标要用 Zotero 的 context 约定。** `fill="context-fill"` + 填充路径（evenodd 画描边效果），
对应 CSS 里的 `-moz-context-properties`。SVG paint 的 fallback 是空格分隔，
写成 `stroke="context-stroke, currentColor"` 会解析失败导致图标不可见。

**`createZToolkit()` 不能读 `addon` 全局。** 它在 `new Addon()` 构造期间被调用，
那时 `addon` 还没赋值，要直接 import `config`。

**jiti 版本冲突。** `c12@4`（脚手架依赖）需要 jiti v2 的 `createJiti`，
但 Tailwind v3 会把 jiti@1 提升到根目录。根上显式声明 `jiti@^2` 即可。

**section 的渲染时机。** `itemDetails.render()` 的顺序是 `box.item = item`（触发 onItemChange）
→ `if (!collapsed && !box.hidden && box.render) box.render()`。所以 `onItemChange` 里
`setEnabled(true)` 之后，同一轮就会 render。但如果 section 处于 hidden/skipRender，
render 会被记为 pending，要等展开或下一次 item change 才补上。
