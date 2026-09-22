# 0004. 历史 append-only

**状态**：已采纳（sqlite 已落地；消息只 INSERT，新对话归档旧会话）
**日期**：2026-09

## 背景

[0003](0003-prefix-freeze.md) 要求前缀逐字节稳定。历史消息是前缀的一部分，
所以任何"编辑某条消息""删除某轮""切换分支"都会让那个位置之后的缓存全部作废。

## 决策

消息存储只 INSERT，永不 UPDATE/DELETE。`seq` 单调递增。

对应地，UI 不提供编辑、删除、分支切换。

## 理由

### assistant-ui 的 capability gating 恰好表达这一点

`useExternalStoreRuntime` 的 adapter 是 capability-gated 的：不传 `onEdit` /
`setMessages`，运行时就把相应能力报告为不可用，UI 自动不渲染编辑按钮和分支选择器。

也就是说 **append-only 不变量在 UI 层是免费的**，不需要写任何禁用逻辑。这不是
巧合带来的便利，而是选 assistant-ui 的实质理由之一。

### 重试的规则

`onReload` **只在上一轮流式未成功结束时提供**——那时它还没 commit 进 ledger、
没进入前缀，重试不破坏不变量。已 commit 的轮次不可重试。

### 上下文满了怎么办

不能重写历史，所以"压缩"变成"换会话"：

- 软阈值 70%：提示
- 硬阈值 85%：生成 checkpoint 摘要 → **新建会话**，其 `[1]` 是**字节完全相同的
  paper block**（缓存仍复用），`[3]` 放上一段 checkpoint；旧会话归档只读

这样"重写前缀"这件事永远不会发生。

## 代价

- 用户不能改自己发出去的消息，只能重新问一遍
- 没有分支探索
- 长对话会产生多条会话记录，需要 UI 上把它们串起来展示

## 证据

`dev/assistantProbe.tsx`，只传 `messages`/`isRunning`/`convertMessage`/`onNew` 时
运行时报告的 capabilities：

```json
{
  "switchToBranch": false,
  "edit": false,
  "delete": false,
  "reload": false,
  "unstable_copy": true
}
```

注意这一项最初是用猜的 DOM 属性选择器测的，得到 0 但那是**假阳性**——选择器选不中
任何东西也是 0。改为直接读 `thread.getState().capabilities` 才是权威答案。
