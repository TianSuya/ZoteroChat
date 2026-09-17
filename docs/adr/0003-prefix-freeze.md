# 0003. 前缀冻结换缓存命中

**状态**：已采纳（内存会话已接到发请求路径）
**日期**：2026-09

## 背景

一篇论文全文动辄几万 token。如果每轮问答都全量计费，长对话的成本会让人不敢用——
而"能长时间陪读"正是这个工具的全部价值。

供应商限定 OpenAI 兼容端点，**没有显式缓存断点可用**（不像 Anthropic 的
`cache_control`）。所有这类后端的缓存都是隐式前缀匹配。

## 决策

把 prompt 严格按稳定性排序，让论文全文成为**逐字节不变的前缀**，并且这个不变量
可被验证。

```
[0]     system          固定常量（含 LaTeX 输出约定）。禁止插值日期 / 模型名 / UI 语言 / 论文标题
[1]     user   PAPER    全文
[2]     assistant ACK   固定 ack
[3..n]  历史轮次         append-only
[n+1]   user  CURRENT   <turn-directives>（语言锁，放最前）
                        + 可选 <selection>
                        + <question>
```

`src/llm/prefixBuilder.ts` 的 `buildCurrentUserMessage` 按这个顺序拼当前轮。
划词属于当前轮，见 [0008](0008-selection-suffix.md)。

配套：

- `PrefixLedger` 记录已发送前缀的 hash，每次请求前比对，不一致记 `prefix_break`
- 自写 `stableStringify`（key 排序），禁止裸 `JSON.stringify` 进 prompt
- 全文提取后规范化：去 BOM、`\r\n`→`\n`、NFC、trim、压缩连续空行
- 语言、详略等动态偏好只写在 `[n+1]` 的 `<turn-directives>`，**绝不进 system**
- OpenAI 的 `prompt_cache_key` **尚未发送**。计划值是
  `zc:{libraryID}:{attachmentKey}`；DeepSeek 当前只靠前缀字节匹配。不要在文档里
  假装已经发出去了。

## 理由

`[1][2]` 构成闭合前缀单元，满足 DeepSeek 的完整单元匹配规则（`A+B → A+B+C` 命中，
`A+B → A+C` 不命中），同时让第 3 轮起 `[0..2]` 稳定命中。

一切动态偏好（回答语言、详略）放最后一轮的 `<turn-directives>`，
**绝不进 system**——system 在前缀最前面，动一下整条链全废。语言锁放在当前轮
最前，避免被长问题或选区淹没；目标语言必须**转述**，禁止「引文保持原文」——
那条旧措辞会把英文句子拼进中文回答。

### 为什么必须有 ledger

**缓存失效是静默的。** 请求照常成功，响应照常正确，只是账单变贵。没有 ledger
就只能靠感觉，而"感觉"在这件事上毫无用处。

ledger 把"我们的缓存策略有效"从一个信念变成一个可以被 CI 断言的事实。

### 被放弃的选项

**每问检索**（aidea 的做法）：按问题做 BM25/embedding 检索拼上下文。相关性更精准，
但每轮前缀都变，缓存必然 miss——与目标直接冲突。

**截断 + 重摘要历史**（aidea 的做法）：保留最近 N 条，更早的压成摘要拼回。摘要会
随对话推进重新生成，等于反复重写历史前缀。

## 代价

- **相关性不如检索。** 全文塞进去，模型要自己找相关段落。押的是长上下文模型
  已经够好。
- **长文要一次性固化压缩**，且此后不能随问题调整。
- **上下文满了不能重写历史**，只能换会话（见 [0004](0004-append-only-store.md)）。
- 切模型/端点使缓存完全失效（缓存 model-scoped），要提示用户并记录
  `model` + `endpoint_hash`。

## 证据

已有单元测试（`src/llm/prefixBuilder.test.ts`、`src/i18n/directives.test.ts`）：

- `frozenPrefix` 连续调用 byte-identical
- append-only 追问 `ledger.check` 通过；改写 paper 元数据则 `ok === false`
- 只改 `replyLanguage` 不触发 prefix_break
- 语言锁出现在 `<question>` 之前；zh-CN 指令不含 `original wording`

尚未做（仍在 [roadmap.md](../roadmap.md)）：

- 端到端：一篇真实 PDF 连问 10 题，第 2 轮起
  `prompt_cache_hit_tokens >= paperBlockTokens * 0.9`，全程 `prefix_break == 0`
- A/B 对照：freeze 模式 vs 模拟 aidea 的 rebuild 模式，对比累计 input 成本
