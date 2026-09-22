# 里程碑

## 状态

| 阶段   | 内容                                                                         | 状态                                                                                                                                                           |
| ------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0** | 脚手架、manifest（7/8/9 兼容）、bootstrap、esbuild + Tailwind 管线、热重载   | ✅                                                                                                                                                             |
| **M1** | iframe 挂载 + React root + shadcn 组件 Notion 化 + 高度自适应                | ✅                                                                                                                                                             |
| **M2** | 全文提取 + 规范化 + Chat Completions SSE + `useExternalStoreRuntime` 接线    | ✅                                                                                                                                                             |
| **M3** | `prefixBuilder` + `stableStringify` + `prefixLedger` + usage 归一化 + 成本条 | ✅ 已接到发请求路径；单元测试覆盖 prefix 稳定与 language 不破前缀。`prompt_cache_key` 未发送；端到端命中率尚未专测                                             |
| **M4** | DB 落地（append-only）+ 会话绑定 item + 重启恢复 + 划词 popup                | ✅ sqlite 已按论文恢复主对话与副对话；划词 / 译文见 [adr/0008](adr/0008-selection-suffix.md)                                                                   |
| **M5** | 长文固化压缩 + checkpoint 换会话 + 上下文水位提示                            | ⬜                                                                                                                                                             |
| **M6** | Markdown + MathML、斜杠命令、导出笔记、设置面板                              | ⬜ **渲染 / 斜杠 / 设置 / 语言 / 字号 / 针对选段提问已交付**（[adr/0007](adr/0007-xhtml-html-inject.md)、[adr/0009](adr/0009-aside-overlay.md)）；导出笔记未做 |

## 已完成部分的遗留项

这些不阻塞后续开发，但需要记在案：

| 项                             | 说明                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Zotero 7 未实测**            | 本机只有 9.0.6（Gecko 140）。7 的兼容性靠 `target: firefox115` 和 Tailwind v3 留的余量，没有真机验证 |
| **高度自适应的部分场景未实测** | 窗口缩放、拖 item pane 分栏、兄弟 section 展开折叠——只验证了 observer 挂载和初始计算                 |
| **热重载不重载 iframe 文档**   | 改面板代码后有时需要完整重启。开发夹具会切 tab 强制重建 section 来缓解                               |
| **空状态排版**                 | 窄窗口下提示文字会被 composer 边缘裁到。M6 重排时一并处理                                            |
| **assistant-ui MCP 未接入**    | 官方提供 `https://www.assistant-ui.com/mcp`，接上后查 API 更可靠，目前靠 `/llms-full.txt`            |

## M2 的计划

组件顺序（先用假数据把 UI 做实，再接真实链路）：

1. `Message` —— user 块级 + 左竖线，assistant 裸排版 ✅
2. `Composer` —— 自适应高度 textarea + 选区 chip ✅
3. `SlashMenu` —— cmdk，命令项可配置 ✅
4. `CostBar` —— 命中率 / token / 成本 ✅ 读归一化后的 usage

然后接线：

5. `context/extract.ts` —— `Zotero.PDFWorker.getFullText` + `sourceRevision` ✅
6. `context/normalize.ts` —— 字节规范化（缓存正确性的基石） ✅
7. `llm/client/chatCompletions.ts` —— SSE 流式 ✅
8. `runtime/externalStore.ts` —— `useExternalStoreRuntime` adapter + in-flight 内存态 ✅

M2 测试端点：`deepseek-flash`（DeepSeek-V4.1-Flash），`thinking` 关闭以降低侧栏延迟。前缀冻结与 ledger 已接到发请求路径上；成本条读 `prompt_cache_hit_tokens`。划词见 M4 已交付部分。

## 计划中的模块

```
src/
  context/
    extract.ts        PDFWorker + sourceRevision 缓存
    normalize.ts      去 BOM / 换行统一 / NFC / trim / 压缩空行
    freeze.ts         长文一次性固化压缩
  llm/
    prefixBuilder.ts  分层组装 [0..n+1]
    prefixLedger.ts   hash 比对 + prefix_break 检测
    stableStringify.ts
    usage.ts          多方言 usage 归一化
    client/
      chatCompletions.ts
      responses.ts    可选增强（仅真 OpenAI）
      capabilities.ts 端点能力探测 + 失败降级
      sse.ts
  store/
    db.ts             绝对路径打开 zoterochat.sqlite（外部库）
  reader/
    selection.ts      ✅ popup + 芯片 + dismiss + 解释选区
  runtime/
    externalStore.ts  assistant-ui adapter
    inflight.ts       流式内存态
```

## 计划中的表结构

```sql
zc_conversations(id, library_id, item_key, model, endpoint_hash,
                 prompt_cache_key, prefix_hash, archived, created_at)
zc_messages(id, conversation_id, seq, role, content, usage_json, created_at)
zc_documents(item_key, source_revision, strategy, text, char_count,
             token_estimate, hash, frozen_at)
zc_cache_events(id, conversation_id, seq, kind, detail_json, created_at)
```

`zc_messages` 只 INSERT，`seq` 单调递增（[adr/0004](adr/0004-append-only-store.md)）。

## 验证计划

M3 之后要能证明"缓存命中率高"，而不是声称：

1. **单元测试**：`normalize()` 幂等；`buildPrefix(item)` 连续 20 次 byte-identical；
   `stableStringify` 对 key 乱序对象输出一致；`prefixLedger` 能定位人为注入的差异
2. **端到端断言**（可用本地 Ollama 免费验证）：一篇真实 PDF 连问 10 题，
   第 2 轮起 `cached_tokens >= paperBlockTokens * 0.9`，全程 `prefix_break == 0`。
   允许单轮归零（OpenAI 是 best-effort），连续两轮归零即失败
3. **A/B 对照**：同组问题跑 freeze 模式 vs 模拟 aidea 的 rebuild 模式，
   对比累计 input token 成本、TTFT、命中率曲线
4. **平台验收**：Zotero 7 与 9 各跑一遍；明暗主题切换
