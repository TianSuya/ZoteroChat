# 系统结构

## 一句话

插件分成**两侧**，中间隔着一个 iframe：插件侧跑在 Zotero 的 bootstrap 沙箱里、
能访问 Zotero API；面板侧跑在一个真实 HTML 文档里、跑 React。

为什么要这么分，见 [adr/0001-ui-in-iframe.md](adr/0001-ui-in-iframe.md)。

```
Zotero 主窗口（XUL 文档，document.body === null）
│
└── item pane section「对话」
    └── <div> wrapper                      高度由 sizing.ts 自适应
        └── <iframe src="chrome://zoterochat/content/panel.xhtml">
            └── 真实 HTML 文档（有 document.body）
                ├── <style> Tailwind 产物（以字符串打进 bundle）
                ├── #zc-root   ← React createRoot
                └── <body>     ← Radix 浮层原生 portal 目标
```

## 两侧职责

|          | 插件侧                                                | 面板侧                                              |
| -------- | ----------------------------------------------------- | --------------------------------------------------- |
| 运行环境 | bootstrap 沙箱（非 window，无 DOM 全局）              | XHTML 文档（正常浏览环境）                          |
| bundle   | `content/scripts/zoterochat.js`                       | `content/scripts/panel.js`（含 KaTeX，dev 约数 MB） |
| 第三份   | `content/scripts/preferences.js`（设置页，独立 iife） |                                                     |
| tsconfig | `tsconfig.plugin.json` → zotero-types `sandbox` entry | `tsconfig.panel.json` → zotero-types `xhtml` entry  |
| 能访问   | `Zotero.*`、`Services.*`、item pane API               | `document`、`window`、React、Radix                  |
| 不能访问 | DOM（类型系统会挡住）                                 | Zotero API（除非经由 bridge）                       |
| 日志     | `ztoolkit.log`                                        | `report()`（经 `window.parent.Zotero.debug`）       |

**类型系统就是边界。** 两份 tsconfig 用了 zotero-types 的不同 entry，在插件侧写
`document` 会直接编译失败，而不是等到运行时才炸。这是刻意的——这条边界如果只靠
约定，迟早会被越过。

## 数据流

```
Zotero item pane
      │ onRender({ body, item, tabType })
      ▼
register.ts ──► createPanelFrame(doc, bridge)
      │                │
      │                ├── 建 wrapper + iframe，挂 __zcOnReady 回调
      │                └── 读宿主主题变量
      │
      │  （iframe 加载，panel.js 执行）
      │
      ▼         frameElement.__zcOnReady()
frame.ts ──► frameWin.__zcMount(bridge)
                       │
                       ▼
              panel-app/index.tsx ──► React createRoot ──► App ──► Thread
```

### 握手为什么不用 `load` 事件

iframe 的 `load` 事件在 item pane 里不可靠（实测不触发）。而且它回答的是错误的
问题：宿主需要知道的是**面板 bundle 就绪**，不是文档解析完。

所以宿主在**插入 DOM 之前**把 `__zcOnReady` 挂到 frame 元素上，面板 bundle 执行到
最后回调它。插入前挂载保证了面板不可能先于监听方发信号。

### bridge 契约

定义在 [`src/panel-app/bridge.ts`](../src/panel-app/bridge.ts)。两侧同进程同权限，
所以是**直接对象传递**，没有 postMessage、没有序列化。接口保持显式是为了让「UI 被
允许碰什么」一眼可见。

当前字段（完整定义见 `bridge.ts`）：

```ts
interface PanelBridge {
  itemID: number;
  paperTitle: string;
  env: "development" | "production";
  showProbe: boolean;
  showAssistantProbe: boolean;
  beginConversation: () => Promise<BridgePaperStatus>;
  streamTurn: (req, handlers) => BridgeStreamJob;
  beginAside: (req: { id: string; quote: string }) => void;
  streamAsideTurn: (req: { asideId: string; question: string }, handlers) => BridgeStreamJob;
  openPreferences: () => void;
  getUiLanguage: () => UiLanguage;
  onUiLanguageChange?: (listener) => () => void;
  getFontSize: () => number;
  onFontSizeChange?: (listener) => () => void;
  onPrefsApplied?: (listener) => () => void;
  getSelection: () => BridgeSelection | null;
  dismissSelection: () => void;
  onSelectionChange?: (listener) => () => void;
  onExplainRequest?: (listener) => () => void;
  theme: { mode: "light" | "dark"; tokens: Record<string, string> };
  onThemeChange?: (listener) => () => void;
}
```

发一轮：面板 `useThreadRuntime` 把**芯片上的选区**（用户叉掉则为 `null`）和问题交给
`streamTurn` → `prefixBuilder` 组装 `[0..2] + 历史 + 当前轮` → Chat Completions SSE。
`fetch` 走主窗口（bootstrap 沙箱没有 browsing context），API key 留在插件侧。
默认端点 DeepSeek，`thinking: { type: "disabled" }`。展示用历史只存在面板内存里；
插件 `session.ts` 按 `itemID` 另存一份 wire-format 轮次和冻结前缀。关标签即丢，
sqlite 尚未落地。

同一 section body **换 PDF** 时拆掉旧 iframe 再建，不 reparent
（[adr/0005](adr/0005-no-frame-reparent.md)）。

## 目录结构

```
src/
  index.ts                插件入口，挂 Zotero.ZoteroChat
  addon.ts                Addon 类（data / hooks / registry）
  hooks.ts                生命周期：onStartup / onShutdown / onMainWindowLoad

  panel/                  ── 插件侧 ──
    register.ts             registerSection；无 PDF 空状态；换 item 拆重建 frame
    frame.ts                建 iframe、主题桥接、就绪握手
    sizing.ts               高度自适应 item pane

  panel-app/              ── 面板侧入口 ──
    index.tsx               React 挂载、样式注入、__zcMount / __zcOnReady
    App.tsx                 根组件，应用主题 token
    bridge.ts               两侧共享的契约（纯类型）

  ui/                     ── 面板侧 UI ──
    Thread.tsx              assistant-ui Thread（header / 消息区 / composer / 成本条）
    thread/                 Welcome / Message / Composer / SlashMenu / CostBar
    markdown/               markdown-it + KaTeX MathML
                            render.ts / mathPlugin.ts / MarkdownText.tsx / SafeHtml.tsx
                            setHtml.ts：禁止 innerHTML，DOMParser + 有限 importNode
                            （[adr/0007](adr/0007-xhtml-html-inject.md)）
    ReplyLanguage.tsx       优先语言上下文
    ErrorBoundary.tsx       渲染期异常兜底（沙箱里没有 console）
    components/             shadcn 生成物，已按 Notion token 重写
    lib/cn.ts               clsx + tailwind-merge
    styles/tailwind.css     设计 token + Tailwind 入口

  runtime/                ── 面板侧对话运行时 ──
    externalStore.ts        展示用历史 + 把回合交给插件 streamTurn
    asideStore.ts           副对话 overlay 的独立 runtime

  translate/              ── 划词弹窗翻译 ──
    index.ts / engines/     Google / DeepL / Google Cloud / Azure / 对话模型
                            fetch 走主窗口；不碰论文前缀

  context/                ── 插件侧 ──
    extract.ts / normalize.ts

  llm/                    ── 插件侧 ──
    session.ts              按 itemID 的内存会话 + streamTurn / beginAside + testConnection
    prefixBuilder.ts        分层组装 [0..n+1]
    prefixLedger.ts         hash 比对 + prefix_break
    prompts.ts              冻结 system（含 LaTeX 约定）+ ACK
    stableStringify.ts / usage.ts / types.ts / secrets.ts
    client/chatCompletions.ts  SSE；主窗口 fetch；thinking disabled
    client/sse.ts

  i18n/                   ── 语言包 ──
    commands.ts             快捷提问 / 解释选区 prompt
    directives.ts           当前轮语言锁（不进冻结前缀）
    panelCopy.ts / languages.ts / prefs.ts

  prefs/                  ── 设置页 ──
    register.ts             PreferencePanes.register
    pane.ts                 设置页 DOM（独立 bundle）

  reader/                 ── 划词 ──
    selection.ts            popup 监听、芯片同步、dismiss 后禁止 live 回读、解释选区

  dev/                    ── 仅 development 构建编入 ──
    seed.ts                 往空库导入夹具 PDF 并打开阅读器
    radixProbe.tsx          四类浮层在 iframe 内的自动化验证
    assistantProbe.tsx      assistant-ui 运行时验证
    checkSizing.ts          高度自适应在两种滚动状态下的验证

  utils/
    ztoolkit.ts             BasicTool 实例（插件侧）
    report.ts               跨边界日志（面板侧）

addon/
  bootstrap.js            Zotero 插件生命周期入口
  manifest.json           声明 Zotero 7/8/9 兼容
  prefs.js                默认首选项
  content/panel.xhtml     面板文档
  content/preferences.xhtml  设置页片段
  content/preferences.css
  content/icons/          Logo PNG（48/96 插件；16/20 sidenav）
  locale/*/panel.ftl      Fluent 本地化
  locale/*/preferences.ftl

assets/
  logo.png                方标（插件管理器 / sidenav）
  logo-h.png              横标（GitHub README）
```

`runtime/externalStore.ts` 只保存**展示用**历史。发请求时面板把当前问题交给插件，由 `llm/session.ts` 组装冻结前缀 + append-only 轮次，再走 Chat Completions SSE。API key 写在设置页（profile prefs），开发期若为空则回退 `devApiKeyFile`。

## 尚未实现

对照 [roadmap.md](roadmap.md)：

```
  context/freeze.ts       超长 PDF 一次性固化压缩
  store/                  独立 sqlite 持久化对话
  导出笔记                 助手回复写入 Zotero note
  prompt_cache_key        请求体尚未带这个字段
```
