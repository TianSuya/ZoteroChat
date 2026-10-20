# 0010. 工具调用、Ask User 与选段笔记

**状态**：已采纳（主对话）
**日期**：2026-10

## 背景

下一阶段要在阅读对话里加入三件事：

1. 让模型通过 DeepSeek Search / Fetch 主动查资料，并在用户明确要求时下载论文、加入 Zotero。
2. 让模型在关键选择上向用户提问，而不是猜。
3. 让用户对对话里的选段写自己的笔记。

这三件事都必须和已有的两条不变量共存：**论文前缀冻结**、**历史只追加**。
笔记是纯用户数据，不能因为写笔记就改变模型前缀。

## 决策

### 工具走 Chat Completions 的 tool calls

OpenAI 兼容端点的工具调用是“模型返回 `tool_calls` → 客户端执行 → 追加
`role: "tool"` 结果 → 再请求模型”的循环。`src/llm/agent.ts` 实现这个循环，
最多 6 轮。

- `ChatMessage` 增加可选的 `tool_calls` / `tool_call_id` / `name`，`content`
  仍是字符串，避免把 append-only 存储改成另一套格式。
- SSE 的 `delta.tool_calls` 由 `ToolCallCollector` 按 `index` 拼装；参数是分片
  到达的，不能逐片 `JSON.parse`。
- 中间 assistant(tool_calls) / tool 消息全部追加进 wire history，但
  `zc_messages.visible = 0`，不渲染成聊天气泡；最终 assistant 一行的
  `tool_trace_json` 保存用户可见的操作记录。
- 工具定义本身不进入 messages，只进入请求体；顺序和措辞保持稳定。

### Search / Fetch 是独立 REST API

`POST {base}/v1/tools/search` 与 `/v1/tools/fetch`，Bearer 认证。默认 base
`https://api.deepseek.com`。搜索 Key 可单独填写，留空回退主 Key。Search/Fetch
按成功请求计费，不按 token；面板的工具 trace 只记录调用，不把它混进 LLM
usage。

### 论文入库必须确认

模型可以调用 `add_paper_to_zotero`，但客户端在执行写入前通过
`onConfirmPaper` 向用户展示标题、来源、DOI，用户确认后才下载。安全边界：

- 只接受 http(s)、无凭据、非 localhost/私网/链路本地地址
- 下载后检查文件大小和 `%PDF-` 魔数
- 按 DOI 在当前 library 去重
- 在 PDF 所属 library 创建 `journalArticle` 父条目 + 子附件，并沿用当前条目的
  collection
- 附件失败时回滚父条目

### Ask User 是一个阻塞式工具

`ask_user` 由客户端执行：插件把问题交给面板，面板在 composer 上方显示问题卡，
用户提交后回答作为 tool 结果继续模型循环。用户跳过返回
`The user skipped the question.`；停止/关闭面板以 AbortError 结束当前回合。

这一版不持久化“等待中的提问”。面板重载或切换 PDF 会中断等待；已经完成的
wire 历史不会丢。

### 笔记不进 prompt

`zc_notes` 只存 `conversation_id`、`message_id`、`quote`、`note`、时间戳。
笔记不参与 `buildRequestMessages`，因此写笔记不会改变前缀或缓存。

UI 上：

- 选中主对话任意消息文字 → 浮动条“记笔记”/“针对选段提问”
- 笔记在原文上用暖色高亮标记；点击高亮直接打开编辑/删除，不再在消息末尾追加笔记列表
- 编辑器复用 `.zc-float` 不透明底，支持编辑和删除

### 范围

首版工具、Ask User、笔记都只作用于主对话。副对话保持原有的论文内短问，不注入
工具，也不显示笔记入口。这样避免在 overlay 里再维护一套 tool loop 和确认流程。

## 代价

- 工具消息会拉长对话，长搜索/抓取可能明显增加 input token；抓取正文截断到
  24k 字符。
- 模型可能调用工具失败；错误以 `ERROR: …` 的 tool 结果返回，由模型自行恢复，
  不会中断整个回合。
- 论文下载依赖目标站点可用性和 `Zotero.Attachments.downloadFile` 的 cookie/
  重定向行为；非直链 PDF 可能失败。
- 笔记只存在当前 profile 的 sqlite，不导出、不同步；首版也没有全局笔记列表。
- 搜索/抓取工具的可用性取决于端点是否支持 tool calls；非 DeepSeek 兼容端点
  仍需要单独验证。

## 证据

- `src/llm/client/toolCallDelta.test.ts`：分片、并行、重复 name、缺失 id
- `src/llm/agent.test.ts`：单轮/工具轮/最大轮数
- `src/tools/search.test.ts`：端点、请求体、结果映射、错误
- `src/tools/library.test.ts`：URL 安全边界、arXiv/OpenReview PDF 解析
- `src/tools/execute.test.ts`：搜索、ask_user、错误恢复、危险 URL 不入库
- `npm run check`：lint、格式、类型、61 个单测通过
- `npm run build:production`：产出 XPI
- `sqlite3` 模拟 v1 库：补列后旧消息 `visible=1`，tool 消息 `visible=0`，`zc_notes` 可写
