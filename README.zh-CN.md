<p align="center">
  <img src="assets/logo-h.png" alt="ZoteroChat" width="440">
</p>

<p align="center"><strong>在 Zotero 里，和论文真正聊起来。</strong></p>
<p align="center">读论文 · 查资料 · 记笔记 · 收进文库</p>

<p align="center">
  <a href="https://github.com/TianSuya/ZoteroChat/releases/latest">下载最新版</a> ·
  <a href="README.md">English</a> ·
  <a href="docs/">设计文档</a> ·
  <a href="docs/changelog.md">更新记录</a>
</p>

---

ZoteroChat 不是一个独立聊天窗口，而是 Zotero 阅读器右侧栏里的论文搭子。它把当前 PDF 的全文留在上下文里，所以你不用每次重复“这篇论文讲了什么”；读到不懂的句子，可以立刻追问、查外部资料，甚至把相关论文找回来。

论文对话按 PDF 保存，笔记对话按独立笔记保存。关掉 Zotero，明天再打开同一篇论文或笔记，对话、工具记录都还在原处。

## 两种工作台

- **打开 PDF**：右侧栏是论文搭子，围绕当前论文对话，支持选中翻译、副对话和原句笔记。
- **打开独立笔记**：右侧栏变成 **Note surface**，可以检索论文、读 PDF、把选中的一批论文入库，也可以让 Agent 直接把总结写进这条笔记。它和论文对话共用同一套消息、工具记录和批量入库确认卡。

Note surface 的设计与限制见 [docs/note.md](docs/note.md)。

<p align="center">
  <img src="docs/screenshots/readme/01-hero.png" alt="ZoteroChat 在 Zotero 阅读器右侧栏中围绕 Attention Is All You Need 对话" width="100%">
</p>

## 为什么是 ZoteroChat

- **论文是主角。** 打开 PDF 就带着全文和元数据开始对话，追问不会变成“无上下文的聊天”。Markdown、表格和 LaTeX 公式直接渲染。
- **不打断阅读。** 解释选段、副对话、写笔记都在右侧栏完成，不需要在 PDF 和网页之间来回切换。
- **能查证，不只靠记忆。** 需要外部信息时，助手可以调用 DeepSeek Search / Fetch，回答里附来源链接，工具记录会留在消息下方。
- **你的库，你掌控。** 下载论文前一定先确认，不会偷偷往 Zotero 里塞条目；对话和笔记保存在本地 profile 的 sqlite 里。

## 读到不懂的地方，直接查

选中一段文字后，可以直接问“这段在说什么”；需要相关工作、最新进展或原文出处时，助手会搜索网页、读取页面，再把结论和来源一起给你。

- 主对话和「针对选段提问」的副对话都可以调用检索工具。
- 回答里的来源是可点击的 Markdown 链接。
- 每次搜索、抓取都会显示成一条紧凑的工具记录；失败也会给出原因，不会静默消失。

<p align="center">
  <img src="docs/screenshots/readme/02-search.png" alt="ZoteroChat 搜索结果、引用链接和工具 trace" width="430">
</p>

<p align="center"><sub>搜索、抓取和引用都留在这条回答下面；长对话不会把论文挤出上下文。</sub></p>

## 一句话的副对话，不打断正文

助手回答里有一句没看懂？选中它，点「针对选段提问」，就会在主对话上盖一层短问。问完点「← 正文」或按 Esc，回到离开时的位置。

副对话复用同一篇论文的前缀，所以不用重新读一遍全文；它也不会把主时间线拉长。每条副对话在原文下留一个标记，随时可以再打开。

<p align="center">
  <img src="docs/screenshots/readme/05-aside.png" alt="ZoteroChat 针对选段提问的副对话 overlay" width="430">
</p>

<p align="center"><sub>副对话只盖住侧栏，不改变主对话的滚动位置和消息顺序。</sub></p>

## 笔记写在原句上

读到有想法的地方，选中对话里的文字，点「记笔记」。这句话会原地变成暖色高亮，和副对话的蓝色下划线区分开；点击高亮即可编辑或删除。

- 笔记按消息和原句保存，重新打开 PDF 仍在。
- 笔记是给你自己看的，**不会发给模型**，也不会改变对话前缀。
- 不需要另开一个笔记应用，读到哪、记到哪。

<table>
  <tr>
    <td width="50%" align="center" valign="top">
      <img src="docs/screenshots/readme/03-note-highlight.png" width="400" alt="ZoteroChat 在原句上显示笔记高亮"><br>
      <sub>选中的原句用暖色高亮标记</sub>
    </td>
    <td width="50%" align="center" valign="top">
      <img src="docs/screenshots/readme/04-note-editor.png" width="400" alt="ZoteroChat 笔记编辑器"><br>
      <sub>点击高亮即可编辑或删除笔记</sub>
    </td>
  </tr>
</table>

## 该问你的时候，先问你

不是所有问题都能从论文里推断。需要你做选择时，助手会在输入框上方弹出一张问题卡，支持快捷选项、自由文本或跳过；你的回答会作为工具结果继续喂回模型，而不是让它猜。

## 确认之后，再写进 Zotero

当你明确说“把这篇论文加到 Zotero”时，助手会先给出确认卡：标题、来源、DOI、年份、作者。确认后才下载 PDF、校验文件、按 DOI 去重，并在当前论文所属的 library / collection 创建条目。

- 每次写入前都确认，不会在后台偷偷改库。
- 只接受公开的 http(s) 地址；下载后会检查 PDF 魔数和大小。
- 直链 PDF、arXiv 和 OpenReview 会自动处理；需要登录或 CAPTCHA 的出版商页面可能失败，但会在工具记录里说明原因。

## 关掉再打开，对话还在

对话按 PDF 保存在当前 Zotero profile 的 `zoterochat.sqlite` 中，消息只追加、不改写。重新打开论文会恢复：

- 主对话和副对话
- 搜索 / 抓取 / 入库的工具记录
- 你写过的笔记

「新对话」会把当前线程归档并另起一条空会话，不会删除旧记录。

## 安装

1. 从 [Releases](https://github.com/TianSuya/ZoteroChat/releases/latest) 下载最新的 `zotero-chat.xpi`。
2. 在 Zotero 打开 **工具 → 插件 → 齿轮 → 从文件安装插件…**，选择 XPI。
3. 重启 Zotero，打开 **Zotero → 设置 → ZoteroChat**（Windows/Linux 为 **编辑 → 设置**）。
4. 填入 Base URL、API key 和模型；需要使用联网搜索时，再填搜索 key（可留空复用主 key）。
5. 在阅读器打开 PDF，点击右侧栏的对话图标。

## 配置

| 设置          | 默认值                     | 说明                                        |
| ------------- | -------------------------- | ------------------------------------------- |
| Base URL      | `https://api.deepseek.com` | OpenAI 兼容的 Chat Completions 端点         |
| 模型          | `deepseek-flash`           | 支持工具调用的模型即可                      |
| API key       | 空                         | 保存在当前 Zotero profile 中                |
| 搜索 API key  | 空                         | 留空复用主 key；Search/Fetch 按成功请求计费 |
| 搜索 Base URL | `https://api.deepseek.com` | 自动补 `/v1/tools/...`                      |
| 回答语言      | 简体中文                   | 快捷提问和回答使用；不影响论文前缀          |

<p align="center">
  <img src="docs/screenshots/readme/06-settings.png" alt="ZoteroChat 设置页：Base URL、API key、模型和阅读偏好" width="720">
</p>

## 兼容性与边界

- 开发验证在 **Zotero 9.0.6 / Gecko 140** 上完成；Zotero 7/8 是兼容目标，但还没有完整真机矩阵。
- 端点需要支持 Chat Completions；搜索、抓取、Ask User 和论文入库还需要端点的工具调用能力。
- 论文下载覆盖直链 PDF、arXiv 和 OpenReview；需要登录、CAPTCHA 或额外跳转的出版商页面可能失败。
- 等待中的 Ask User 不跨面板重载恢复；已经完成的回合仍保存在历史里。
- 笔记目前只存在当前 profile，不导出 Zotero 笔记，也不同步到其他设备。
- 超长论文的自动压缩和上下文水位提示尚未实现；上下文窗口仍由模型决定。

## 开发

```bash
npm ci
npm run check          # lint + format + typecheck + tests
npm run build:production
npm start              # 独立的 dev Zotero 实例
```

架构、缓存策略、Zotero 踩坑记录和 ADR 都在 [docs/](docs/) 里。开发前建议先读 [overview.md](docs/overview.md)、[architecture.md](docs/architecture.md) 和 [environment.md](docs/environment.md)。

## 数据与隐私

PDF 文本在本地由 Zotero 提取。发送问题时，配置的模型端点会收到论文文本、文献元数据、对话历史、你的问题和本轮附带的选区；插件发送的是文本，不是 PDF 文件本身。

API key 保存在当前 Zotero profile 的首选项中，并非独立加密凭据库。笔记和对话保存在当前 profile 的 `zoterochat.sqlite`。Search / Fetch 请求会发送到你配置的搜索端点，计费与数据保留政策由服务商决定。

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md)。商业使用需要单独的书面许可；分发时请保留许可证文本或官方链接。

Required Notice: Copyright (c) 2026 bowentian
