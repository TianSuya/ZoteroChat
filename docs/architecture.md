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

| | 插件侧 | 面板侧 |
|---|---|---|
| 运行环境 | bootstrap 沙箱（非 window，无 DOM 全局） | XHTML 文档（正常浏览环境） |
| bundle | `content/scripts/zoterochat.js`（~14KB） | `content/scripts/panel.js`（~600KB dev） |
| tsconfig | `tsconfig.plugin.json` → zotero-types `sandbox` entry | `tsconfig.panel.json` → zotero-types `xhtml` entry |
| 能访问 | `Zotero.*`、`Services.*`、item pane API | `document`、`window`、React、Radix |
| 不能访问 | DOM（类型系统会挡住） | Zotero API（除非经由 bridge） |
| 日志 | `ztoolkit.log` | `report()`（经 `window.parent.Zotero.debug`） |

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

当前字段：

```ts
interface PanelBridge {
  itemID: number;
  paperTitle: string;
  env: "development" | "production";
  showProbe: boolean;            // 开发期探针开关
  showAssistantProbe: boolean;
  theme: { mode: "light" | "dark"; tokens: Record<string, string> };
  onThemeChange?: (listener) => () => void;
}
```

## 目录结构

```
src/
  index.ts                插件入口，挂 Zotero.ZoteroChat
  addon.ts                Addon 类（data / hooks / registry）
  hooks.ts                生命周期：onStartup / onShutdown / onMainWindowLoad

  panel/                  ── 插件侧 ──
    register.ts             registerSection，per-body 创建 frame
    frame.ts                建 iframe、主题桥接、就绪握手
    sizing.ts               高度自适应 item pane

  panel-app/              ── 面板侧入口 ──
    index.tsx               React 挂载、样式注入、__zcMount / __zcOnReady
    App.tsx                 根组件，应用主题 token
    bridge.ts               两侧共享的契约（纯类型）

  ui/                     ── 面板侧 UI ──
    Thread.tsx              对话骨架（header / 消息区 / composer / 成本条）
    ErrorBoundary.tsx       渲染期异常兜底（沙箱里没有 console）
    components/             shadcn 生成物，已按 Notion token 重写
    lib/cn.ts               clsx + tailwind-merge
    styles/tailwind.css     设计 token + Tailwind 入口

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
  content/icons/          section / sidenav 图标
  locale/*/panel.ftl      Fluent 本地化
```

## 尚未实现（M2 起）

规划中但还没写的模块，占位在这里以便对照
[roadmap.md](roadmap.md)：

```
  context/      extract.ts / normalize.ts / freeze.ts    全文提取与固化
  llm/          prefixBuilder / prefixLedger / client/   前缀组装与缓存校验
  store/        db.ts / conversations / messages         独立 sqlite 持久化
  reader/       selectionPopup.ts / selection.ts         划词
```
