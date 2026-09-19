# UI 约定

## 技术栈

| 层         | 选择                                      | 状态                                                   |
| ---------- | ----------------------------------------- | ------------------------------------------------------ |
| 框架       | React 18                                  | —                                                      |
| 对话运行时 | `@assistant-ui/react` headless primitives | 已验证（见 [development.md](development.md#验证探针)） |
| 交互原语   | `radix-ui` 统一包                         | 已验证                                                 |
| 组件       | shadcn/ui 生成物，按我们的 token 重写     | 5 个已落地                                             |
| 样式       | Tailwind v3                               | [adr/0002](adr/0002-tailwind-v3.md)                    |
| 图标       | lucide-react，1.5px stroke，16px          | —                                                      |
| 命令面板   | cmdk                                      | 已验证                                                 |

**shadcn 组件不能直接 `npx shadcn add` 就用**：它默认 Tailwind v4 + React 19，
我们是 v3 + React 18。流程是把生成物拿进 `ui/components/`，然后按下面的 token
重写 variants，不保留默认样式。

## Notion 设计哲学 → 可执行规则

不是"用 Notion 的颜色"，而是落到能被 review 的约束：

| 原则             | 具体做法                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 内容优先         | 无卡片边框、无阴影分隔线。层次靠背景色差 + 留白，不靠描边                                                                |
| 块级排版而非气泡 | user message = 浅背景块 + 左侧 2px 竖线；assistant message = 纯正文无容器。300px 宽下比气泡省一大截空间                  |
| hover-reveal     | 复制 / 存为笔记 / 重试 等操作默认 `opacity-0`，hover 才淡入（`.zc-reveal`），120ms                                       |
| 克制的圆角       | 3–4px，绝不 `rounded-lg` 以上                                                                                            |
| 8px 网格         | 间距取 4/8/12/16/24；正文字号由设置 `fontSize`（12–18，默认 14）驱动 `--zc-font-size`，Tailwind `text-*` 用 rem 相对缩放 |
| 单一强调色       | 只用于主按钮和链接，其余一律中性灰阶                                                                                     |
| 克制的动效       | 只做 opacity / background-color，20–120ms，不做位移和缩放                                                                |
| 界面让位于内容   | 不做工具栏按钮；用 composer 里的 `/` 斜杠命令菜单代替                                                                    |

## 设计 token

定义在 [`src/ui/styles/tailwind.css`](../src/ui/styles/tailwind.css)，
**写在 `@layer` 外面**（原因见 [environment.md §7.2](environment.md#72-tailwind-v3-会-purge-layer-内基于-class-的规则)）。

| token                           | 映射                                | 用途                     |
| ------------------------------- | ----------------------------------- | ------------------------ |
| `--zc-surface`                  | `--material-sidepane`               | 面板底色                 |
| `--zc-surface-subtle`           | `--material-mix-quarternary`        | user 消息块、composer 底 |
| `--zc-surface-hover`            | `--fill-quinary`                    | hover 态                 |
| `--zc-surface-raised`           | 固定白 / `#2b2b2b`                  | **浮层专用**             |
| `--zc-border`                   | `--fill-quinary`                    | 边框                     |
| `--zc-fg` / `-muted` / `-faint` | `--fill-primary/secondary/tertiary` | 三级文字                 |
| `--zc-accent`                   | `--color-accent`                    | 强调色                   |

两条容易踩的：

**浮层必须用 `--zc-surface-raised`。** 用 `--zc-surface` 会和侧栏同色，菜单看起来
像透明的。

**`--material-border-*` 不能当颜色用。** 它的值是 border 简写
（`1px solid rgba(...)`），所以边框从 `--fill-quinary` 派生。

每个 token 都带 fallback 值——Zotero 的变量名不是公开 API，改了名至少要能降级到
静态配色而不是整个没样式。

## 主题跟随

CSS 自定义属性不跨 document 继承，所以宿主主题走显式桥接：

```
frame.ts   读宿主 getComputedStyle(documentElement) 的 Zotero 变量
    │      + matchMedia("(prefers-color-scheme: dark)")
    ▼
bridge.theme = { mode, tokens }
    ▼
App.tsx    写到面板 documentElement 的 style 与 data-zc-theme
    ▼
tailwind.css  .zc-root[data-zc-theme="dark"] 覆盖暗色 token
```

宿主主题变化时 `frame.ts` 会推新值（`onThemeChange`）。

## 布局

### 面板高度自适应

`panel/sizing.ts`。不变量是：**面板底边始终与 item pane 底边对齐**。

两种状态都要满足：

- 静止时被上方 section 推下来 → 填满剩余空间
- 点 sidenav 图标时 Zotero 把 section 滚到顶 → 填满整个面板

所以要用**可见偏移量**（随滚动变化），并以**滚动无关的自然高度**兜底防止反馈回路。
详细推导见 [adr/0006](adr/0006-panel-auto-sizing.md)。

### Thread 结构

交互是 ChatGPT 的（滚动区 + 底部 composer，Enter 发送，运行中变停止），视觉是 Notion 的。整棵树是 assistant-ui primitives，我们只写 class。

```
ThreadPrimitive.Root (flex h-full flex-col)
├── header              h-8 shrink-0     论文标题 + hover 才显的「新对话」
├── Viewport            flex-1 min-h-0   空状态 / 消息 / 滚到底
└── footer              shrink-0         composer + 成本条
```

`min-h-0` 是 flex 子项能正确收缩的前提，漏了会导致消息区撑破容器。

Composer 用 `ComposerPrimitive.Input`（自带 autosize，Enter 发送 / Shift+Enter 换行）。斜杠菜单是 cmdk，输入 `/` 时浮在输入框上方；点一项等于把对应 prompt 发成一轮普通 user turn，不碰冻结前缀。

header 右侧：有消息时 hover 出「新对话」；齿轮始终可见，打开 Zotero 设置里的 ZoteroChat。

**选区芯片**（composer 上方，标「选中内容」+ 页码）：划词后自动出现。发送时以芯片状态为准。叉掉后调用 `dismissSelection`，即使 PDF 里还高亮着，这一轮也不再带选区。重新划词或点「解释选区」才会再附上。见 [adr/0008](adr/0008-selection-suffix.md)。

用户消息里同样渲染「选中内容」块（`encodeUserContent` / `parseUserContent`），避免只有模型看得见。

## 组件清单

已落地（`src/ui/components/`）：`button` `tooltip` `popover` `dropdown-menu` `command`

已落地（`src/ui/thread/`）：`Welcome` `UserMessage` `AssistantMessage` `Composer` `SlashMenu` `CostBar`

助手消息走 `src/ui/markdown/`：markdown-it（`html: false`）+ KaTeX MathML（`$…$` / `$$…$$` / `\(…\)` / `\[…\]`）。**禁止 `dangerouslySetInnerHTML`**，见 [adr/0007](adr/0007-xhtml-html-inject.md)。独立公式容器 `.zc-md-eq` 下方留白给细滚动条，避免压住字形。

用户消息：问题正文 + 可选的「选中内容」引用块。

快捷提问（概括 / 方法 / 局限 / 术语）的文案和 prompt 按设置里的优先语言切换，见 `src/i18n/`。语言指令只写在当前轮的 `<turn-directives>` 里，不进冻结前缀。

流式时 `MarkdownText` 对 markdown+KaTeX 约 48ms 节流，避免半开的 `$$` 每个字符都重解析。

## 设置页

`addon/content/preferences.xhtml` + `preferences.css`，嵌在 Zotero 自己的设置窗口里，
**不是**面板 iframe。视觉约束与对话面板相同：无卡片、无阴影、3–4px 圆角、8px 网格。
宿主主题变量已经在这个窗口上，不必再做 iframe 桥接。

- API key 用原生 `type="password"`（系统眼睛），不要再叠 Show。
- 「优先语言」「字体大小」是 `<select>`：去掉原生箭头、自绘 chevron，否则圆角会裁掉箭头。
- 字号写入 `--zc-font-size`，面板 `documentElement` 的 `fontSize` 同步，对话用 rem 相对缩放。
- 「保存并刷新」把当前表单写入 prefs 并通知已打开的面板重读字号/语言，**不拆掉会话**。测试连接仍是另一颗按钮。按钮是 `zc-actions` 的直接子节点，避免 XUL 里嵌套 flex 把控件挤没。

## 阅读器「解释选区」按钮

按钮插在 `renderTextSelectionPopup` 的 reader 文档里，吃不到面板 Tailwind。
样式必须 inline：`padding: 6px 12px`、`min-height: 28px`、`line-height: 18px`、
`width: 100%`。过小会贴边。见 [adr/0008](adr/0008-selection-suffix.md)。

尚未做的组件：`scroll-area` `separator` `skeleton` `switch` `select`。

新增浮层组件时**不需要**配置 portal container——面板在真实 HTML 文档里，Radix 默认
portal 到 `document.body` 就是对的。（Shadow DOM 方案时期需要，现在不用了。）
