# Note surface：在独立笔记里检索、入库、写总结

## 一句话

打开 PDF 时，右侧栏是论文搭子；打开 Zotero **独立笔记**时，右侧栏变成 **Note surface**。同一个 Thread、同一套工具记录和确认卡，但会话边界是这条笔记，Agent 可以直接把总结写回笔记。

此前挂在文献库列表上的 Collector 已删除：它依赖不稳定的 item-pane 宿主，且“收藏”和“写作”本来就是两个不同任务。现在检索/收集论文的能力跟着笔记走。

## 状态模型

```
tabType = reader + PDF   → Paper surface（论文前缀 + 选区/副对话/笔记）
tabType = note + note    → Note surface（笔记内容 + 检索/入库/edit_note）
其他                     → 当前不是 PDF
```

Note surface 不依赖 DOM host；它走正常的 `ItemPaneManager` section。Zotero 的独立笔记 tab 会 render item pane section，所以没有 Collector 那种宿主替换问题。

## 会话

- key：`note:<libraryID>:<noteKey>`。
- 不同笔记各自有历史；重开 Zotero 仍在。
- prefix：稳定 `NOTE_SYSTEM_PROMPT`。
- 当前笔记内容、标题、note_id 进当前轮 `<note-context>` / `<note-content>`，不冻结进 prefix——因为 Agent 会改它。
- 每轮开始重新读取笔记，所以 Agent 能看到自己上一轮写进去的内容。
- 历史 append-only；新对话归档旧线程。

## 工具

| 工具                       | 用途                                             |
| -------------------------- | ------------------------------------------------ |
| `search_web` / `fetch_url` | 找论文、会议页、DOI 页                           |
| `search_library`           | 查当前 Zotero 库/笔记所在 collection，避免重复   |
| `read_pdf`                 | 读候选 PDF 或库内 PDF，验证内容                  |
| `present_papers`           | 可勾选候选列表 + 一次批量确认；选中后统一入库    |
| `add_paper_to_zotero`      | 单篇入库确认                                     |
| `ask_user`                 | 范围不清时先问                                   |
| `edit_note`                | **追加或替换当前笔记**；Markdown 渲染为安全 HTML |

### edit_note

- 默认 `append`：把 Markdown 小节插入笔记内容末尾，保留原有内容。
- `replace`：整条替换，只有用户明确说“重写/替换整条笔记”时才允许。
- 内容用 markdown-it 渲染，`html:false`，不会写入 script。
- 追加时如果笔记有 `<div data-schema-version="9">` 包装，会插在 wrapper 内部，而不是 wrapper 外。
- 保存后返回标题和新的字符数；tool trace 显示“写笔记 · append/replace”。
- Agent 的 system prompt 明确要求：总结/阅读列表默认 append，不覆盖用户原文；不重复已有小节。

## UX

- header：`Note` badge + 笔记标题 + 字符数。
- 空状态：
  - 总结这条笔记（提炼结构，写回笔记）
  - 找相关论文（检索、读 PDF、勾选入库）
  - 写进笔记（把当前对话要点补成结构化小节）
- composer / slash menu / 消息 / tool trace / 批量确认卡与 Paper surface 一致。
- 不显示 PDF 选区、副对话、论文笔记高亮；这些只属于 Paper surface。

## 典型流程

1. 用户打开一条独立笔记，右侧 Note surface 读取标题和内容。
2. 用户：“总结当前笔记，并找 5 篇相关论文”。
3. Agent：读笔记 → `search_library` → `search_web` → `read_pdf` 验证 → `present_papers` 候选列表。
4. 用户勾选/取消，点一次「加入选中论文 · N」。
5. Agent 继续用 `edit_note` 追加「相关论文」小节，带来源链接。
6. 笔记编辑器显示更新后的内容；下一轮 Agent 读取到更新内容。

## 边界

- `edit_note` 是直接写入，不弹二次确认；`replace` 需要用户明确要求。没有自动备份，依赖 Zotero 自身的撤销/版本机制。
- 远程 PDF `read_pdf` 仍使用临时 attachment，读完立即 erase，不入库。
- 批量入库仍是单选列表 + 一次确认；失败的论文不回滚已成功的。
- 独立笔记的 item pane section 是否显示取决于 Zotero 版本；当前验证版本 Zotero 10 正常。
