# 更新记录

## 未发布

- 设置页去掉自绘的「ZoteroChat」标题，只保留 Zotero 顶部栏那一行。
- 设置页增加「保存并刷新」：写入当前配置并刷新已打开的对话（字号、语言）。字号观察器补上 `global: true`，与写入的 pref 分支对齐。
- 原创代码采用 PolyForm Noncommercial 1.0.0，补充完整许可证与双语授权说明；超出允许用途的商业使用需另行授权。
- 重写中英文 README：前置安装入口、当前限制、兼容性与数据说明；缓存设计与实际命中证据分开表述。
- 中英文 README 完整展示三张原始截图，分别介绍侧栏布局、划词交互与公式排版；支持点击查看原尺寸，并移除静态版本和未经验证的兼容性徽章。
- 增加贡献指南、安全反馈说明、issue / PR 模板和 GitHub Actions 检查。
- 统一 Node.js 24、ESLint / Prettier 配置与检查命令，增加跨平台生产构建命令。
- 更新开发工具依赖并整理格式；不改变对话、选区或请求处理逻辑。
- 为面板探针增加编译期 development 条件，生产包不再包含这两项开发诊断组件。

## 0.1.8 — 2026-09-17

- 插件 Logo 换成 `assets/logo.png`（插件管理器、设置页、阅读器右侧 sidenav、section 标题）。
- GitHub README：英语默认、简体中文可选；横向 Logo；截图位在 `docs/screenshots/`。
- 设计文档与代码对齐：失败路径写入 [environment.md](environment.md) §8–§11；
  [adr/0007](adr/0007-xhtml-html-inject.md)、[adr/0008](adr/0008-selection-suffix.md)；
  [adr/0003](adr/0003-prefix-freeze.md) 的当前轮顺序改为 directives → selection → question，
  并写明 `prompt_cache_key` 尚未发送。

## 0.1.7 — 2026-09-17

- 叉掉输入框里的「选中内容」后，发送不再把该选区塞回上下文。

## 0.1.6 — 2026-09-17

- 设置页增加「字体大小」，实时调整对话窗口正文字号（12–18，默认 14）。

## 0.1.5 — 2026-09-17

- 划词弹窗「解释选区」加大内边距与行高，避免字贴边。

## 0.1.4 — 2026-09-17

- 划词后对话自动带上当前选区，并在消息里用「选中内容」标注。
- 划词弹窗保留「解释选区」：点击后打开对话并针对该段提问。
- 发给模型的 `<selection>` 标明这是用户当前高亮，不是全文。

## 0.1.3 — 2026-09-17

- 支持解释 PDF 选区：划词后 composer 出现选区芯片，发送时带入当前轮上下文。
- 阅读器划词弹窗增加「解释选区」，自动打开对话并提问。

## 0.1.2 — 2026-09-17

- 设置页「优先语言」下拉箭头被圆角裁掉：改为自绘箭头并加大右侧内边距。

## 0.1.1 — 2026-09-17

- 右侧 sidenav 图标始终显示。此前 `onInit` 在 item 尚未就绪时 `setEnabled(false)`，安装后图标会被藏掉。
- 阅读器若传入文献父条目，会解析其 PDF 附件再开聊。
- 库视图点击图标显示「打开一个 PDF」空状态。

## 0.1.0 — 2026-09-17

第一版可安装包。打开 PDF 后即可在右侧「对话」里围绕当前论文提问。

### 能做什么

- 阅读器右侧边栏对话，以当前 PDF 附件为会话边界
- 打开论文时提取全文，冻进 prompt 前缀，后续追问走 append-only，提高缓存命中
- OpenAI 兼容 Chat Completions 流式输出（默认 DeepSeek `deepseek-flash`）
- 设置页配置 Base URL、API key、模型、优先语言
- 快捷提问：概括全文 / 讲解方法 / 局限与问题 / 关键术语（文案和 prompt 随语言切换）
- 斜杠命令（`/`）
- 助手回复 Markdown + LaTeX（行内 `$...$`、独立 `$$...$$`）
- 成本条显示 token 与缓存命中（DeepSeek `prompt_cache_hit_tokens`）

### 这一阶段修过的坑

- 设置页脚本早于 DOM 执行，测试连接无响应：改为 `onload` + `onclick`
- 公式用 `innerHTML` 写入 XHTML 面板会抛 `InvalidCharacterError`：改为 `DOMParser` + `importNode`
- `importNode` 未移走源节点导致死循环吃光内存：改为有限拷贝
- 中英混杂：去掉「引文必须原文」，语言锁放到当前轮最前；公式只保留专有名词和符号
- 公式横向滚动条压住字形：滚动条变细并放到公式下方留白里

### 0.1.0 安装后的修正

- 右侧 sidenav 图标在库视图 / `onInit` 时被 `setEnabled(false)` 藏掉。改为图标始终显示；未打开 PDF 时显示空状态。阅读器若传入父条目，会解析其 PDF 附件。

### 还没做

对照 [roadmap.md](roadmap.md)：

- 对话持久化（关标签 / 重启后历史还在内存里）
- 超长 PDF 的一次性固化压缩
- 导出为 Zotero 笔记
- 发送 `prompt_cache_key`；端到端缓存命中率专测

安装与开发见 [development.md](development.md)。里程碑对照见 [roadmap.md](roadmap.md)。
