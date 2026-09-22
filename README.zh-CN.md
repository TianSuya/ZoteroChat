<p align="center">
  <img src="assets/logo-h.png" alt="ZoteroChat" width="420">
</p>

<p align="center"><strong>在 Zotero 里，边读论文，边提问。</strong></p>

<p align="center">
  <a href="README.md">English</a> · 简体中文<br>
  <a href="#安装">安装</a> ·
  <a href="#界面预览">界面预览</a> ·
  <a href="#兼容性与限制">兼容性</a> ·
  <a href="docs/README.md">文档</a> ·
  <a href="docs/changelog.md">更新记录</a>
</p>

**ZoteroChat** 是 Zotero 侧边栏里的 PDF 阅读助手。围绕当前论文提问、讨论高亮段落，或结合公式理解方法。提取后的论文文本保留在对话上下文中，并通过稳定的请求前缀支持服务商的上下文缓存。

> 对话保存在当前 Zotero profile 的 `zoterochat.sqlite` 中，重新打开同一 PDF 会恢复记录。点「新对话」会归档当前线程并另起一条空会话。

## 功能

- **围绕当前论文讨论。** 从概括全文、讲解方法、局限或关键术语开始，继续追问。
- **针对段落提问。** 划词后将选区附到下一轮，或在阅读器弹窗点击「解释选区」。同一弹窗可显示选段译文。
- **对着回答追问而不翻掉原文。** 「针对选段提问」在主对话上打开一层短问，结束后回到原来的位置。
- **阅读排版完整的回答。** 流式显示 Markdown 和 LaTeX 公式。
- **调整阅读偏好。** 设置回答语言和字号，通过 `/` 使用快捷提问。
- **查看用量。** 在服务商返回相关字段时，显示输入、输出 token 和缓存命中情况。

## 界面预览

紧凑的侧栏、克制的控件和清晰的正文排版，让论文与讨论保持在同一视野中。以下截图使用中文界面，点击图片可查看原尺寸。

### 在论文旁展开对话

无需离开阅读器，即可打开侧栏。从快捷提问开始，逐步理解当前论文。

<p align="center">
  <a href="docs/screenshots/01-reader-chat.png">
    <img src="docs/screenshots/01-reader-chat.png" alt="ZoteroChat 阅读器侧栏，以及欢迎界面与快捷提问的放大细节" width="880">
  </a>
</p>

### 从划词自然进入提问

阅读器弹窗提供「解释选区」，输入框上方的选区芯片显示下一轮将附带的段落，也可以随时移除。

<p align="center">
  <a href="docs/screenshots/02-selection.png">
    <img src="docs/screenshots/02-selection.png" alt="PDF 高亮段落，以及解释选区弹窗和输入框选区芯片的放大细节" width="880">
  </a>
</p>

### 清晰呈现回答与公式

通过标题、段落和公式排版组织详细解释，方便对照原文逐步阅读。

<p align="center">
  <a href="docs/screenshots/03-real-chat.png">
    <img src="docs/screenshots/03-real-chat.png" alt="围绕论文关键公式的回答，右侧放大展示正文层次与数学公式排版" width="880">
  </a>
</p>

## 安装

你需要 Zotero、一篇可提取文本的 PDF，以及可用的模型端点。托管 API 需要自备密钥，请求可能产生费用。

1. 项目发布安装包后，可从 [Releases 页面](https://github.com/TianSuya/ZoteroChat/releases)下载 `.xpi`。若页面不可用或没有安装包，请[从源码构建](#从源码构建)。
2. 在 Zotero 中打开「工具 → 插件 → 齿轮 → 从文件安装插件…」，选择 `.xpi`。
3. 重启 Zotero，打开 macOS 的「Zotero → 设置 → ZoteroChat」，或 Windows/Linux 的「编辑 → 设置 → ZoteroChat」。侧栏齿轮也可以打开设置。
4. 填写 Base URL、API key 和模型，点击「测试连接」检查配置。
5. 用 Zotero 阅读器打开 PDF，点击右侧栏的对话图标。

当前默认配置：

| 设置     | 默认值                     |
| -------- | -------------------------- |
| Base URL | `https://api.deepseek.com` |
| 模型     | `deepseek-flash`           |
| API key  | 留空，需自行填写           |
| 回答语言 | 简体中文，可修改           |

客户端会在 Base URL 后追加 `/chat/completions`。若端点需要 API 版本前缀，请将其包含在 Base URL 中；不要填写完整的补全请求地址。「测试连接」成功不代表流式输出、缓存统计或全部模型参数均已验证。

### 从源码构建

使用 **Node.js 24** 和 npm，在仓库根目录执行：

```bash
npm ci
npm run build:production
```

安装 `.scaffold/build/` 下生成的 `.xpi`。仅构建无需安装 Zotero、配置开发 profile 或提供 API key。打包检查见[发布准备](release/README.md)。

## 使用

1. 在侧栏输入问题，或选择一项快捷提问。
2. 在 PDF 中划词后，选区会显示在输入框上方，并随问题发送。叉掉选区芯片可让下一次请求的新消息不再附带该段；已经发送的选区仍保留在历史中。
3. 按 **Enter** 发送，**Shift+Enter** 换行。回答生成时可以点击停止。
4. 点击「新对话」重置当前会话。请复制需要保留的回答；自动保存和导出 Zotero 笔记尚未实现。

## 兼容性与限制

| 范围     | 当前状态                                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zotero   | 开发验证记录来自 Zotero 9.0.6 / Gecko 140。兼容目标为 Zotero 7–9；Zotero 7、8 尚未完成测试矩阵。                                                      |
| 操作系统 | 跨平台验证尚未完成。反馈兼容性问题时请提供操作系统和 Zotero 版本。                                                                                    |
| 模型端点 | DeepSeek 是已有开发记录的端点。其他 OpenAI 兼容 Chat Completions 服务和本地服务仍需验证；客户端目前统一发送 `thinking` 和流式用量参数，没有能力协商。 |
| 本地服务 | 设置读取逻辑要求 API key 非空，即使本地服务本身不需要身份验证。                                                                                       |
| 对话历史 | 按 PDF 存在当前 Zotero profile。不支持编辑已提交消息或对话分支。点「新对话」会归档旧线程。                                                            |
| 长文档   | 论文与对话需要容纳在模型上下文窗口内，尚未实现自动压缩和上下文上限处理。                                                                              |
| PDF 内容 | 使用提取后的文本，不发送页面图片。没有内置 OCR 或图像理解；文本提取可能丢失排版和公式细节。                                                           |
| 引用     | 全文提取不保留页码映射。请对照论文核实回答和引用。                                                                                                    |

## 数据与隐私

PDF 文本在 Zotero 本地提取。发送问题时，配置的模型端点会收到提取后的论文文本、可用的文献元数据、对话历史、问题和本轮附带的选区。插件发送的是文本，而非 PDF 文件本身。

API key 保存在当前 Zotero profile 的首选项中，并非加密凭据库；请求时会通过认证头发送到配置的端点。请根据文献的数据要求选择服务。数据保留政策与 API 费用由对应服务商决定，ZoteroChat 不包含托管模型订阅。

分享诊断日志前，请移除密钥、私有文献正文和可识别身份的元数据。安全问题的反馈方式见 [SECURITY.md](SECURITY.md)。

## 上下文缓存

ZoteroChat 保持 system 提示与论文文本块稳定，随后追加已完成的对话轮次。回答语言指令和当前选区放在新一轮消息中，以便重复上下文满足服务商的前缀缓存条件。

这里有两个独立信号：`PrefixLedger` 检查本地消息前缀是否改变，服务商返回的用量字段反映实际缓存命中。前缀稳定不保证命中，也不保证特定的费用降幅。端到端缓存基准测试仍待完成，客户端尚未发送 `prompt_cache_key`。

实现细节与验证计划见[上下文设计](docs/overview.md)和[前缀冻结决策](docs/adr/0003-prefix-freeze.md)。

## 常见问题

| 现象             | 检查方式                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| 侧栏提示打开 PDF | 请在 Zotero 阅读器中打开附件；文献库视图不会开始对话。                   |
| 连接失败         | 检查 Base URL、模型、API key 和服务商错误信息。不要在 issue 中贴出密钥。 |
| 文本提取失败     | 确认 PDF 含可选择的文本。纯图片扫描件需要先在插件外完成文本提取或 OCR。  |
| 对话历史消失     | 确认打开的是同一 PDF 附件。只有点「新对话」才会另起空会话。              |
| 没有缓存统计     | 端点可能没有返回流式用量或缓存字段。缺少统计不等于缓存未命中。           |

其他问题请通过 [bug 反馈表单](https://github.com/TianSuya/ZoteroChat/issues/new?template=bug_report.yml)提交复现步骤和版本信息。运行环境排查记录见 [docs/environment.md](docs/environment.md)。

## 开发与贡献

执行 `npm ci` 后，将 `.env.example` 复制为 `.env`，填写 Zotero 可执行文件路径和**独立的开发 profile、数据目录**，再运行 `npm start`。开发时使用可丢弃的文献库。

```bash
npm run check              # Lint、格式、类型检查和单元测试
npm run build:production   # 生产 XPI
```

贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，Zotero 配置与运行时探针见 [docs/development.md](docs/development.md)。欢迎中英文 issue 和 PR；设计文档目前以中文为主。

后续工作包括对话持久化、长文压缩和导出 Zotero 笔记，具体进度见[路线图](docs/roadmap.md)。

## 贡献者

- [TianSuya](https://github.com/TianSuya)
- [JinnWang-JY](https://github.com/JinnWang-JY)
- [shawnliang420](https://github.com/shawnliang420)

## 许可证

ZoteroChat 的原创代码采用 [PolyForm Noncommercial License 1.0.0](LICENSE.md)。由于限制商业使用，项目属于 **源码可用（source-available）**，不属于 [OSI 定义的开源软件](https://opensource.org/osd)。

- **非商业用途：** 允许在许可证规定的用途内使用、复制、修改和再分发，包括个人学习与非商业实验。
- **教育与公共研究：** 许可证明确允许教育机构、公共研究机构及其 Noncommercial Organizations 条款列出的其他组织使用，不因其资金来源或相关资助义务而排除。
- **商业用途：** 超出许可证允许用途的使用，需要向相关权利人另行取得书面授权。例如，将插件换壳销售、基于它提供收费服务或集成到商业产品中，若不属于许可证允许的用途，就需要另行授权；修改代码不会免除这一要求。
- **再分发：** 须附带许可证全文或官方链接，并保留所有 `Required Notice:` 声明。第三方代码与素材仍适用各自的许可证，本许可证不替代其原有条款。

Required Notice: Copyright (c) 2026 bowentian

商业授权咨询请[通过 GitHub issue 联系维护者](https://github.com/TianSuya/ZoteroChat/issues/new?title=Commercial%20licensing%20inquiry)。发起咨询不代表已经获得授权。以上为说明性摘要，具体权利与义务以[完整许可证英文原文](LICENSE.md)为准。
