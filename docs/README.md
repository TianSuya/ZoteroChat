# ZoteroChat 文档

Zotero 侧边栏论文阅读助手。以打开的 PDF 附件为会话边界，把全文常驻上下文，
用**前缀冻结**换取高缓存命中率。

## 从哪里开始

| 你的情况 | 先读 |
|---|---|
| 第一次接触这个项目 | [overview.md](overview.md) → [architecture.md](architecture.md) |
| 要动 UI | [ui.md](ui.md) → [architecture.md](architecture.md) 的「面板侧」 |
| 要动 Zotero 集成 | [zotero-integration.md](zotero-integration.md) |
| 遇到诡异的运行时报错 | [environment.md](environment.md) ← **大概率能在这里找到** |
| 想知道"为什么是这样设计的" | [adr/](adr/) |
| 要跑起来 | [development.md](development.md) |

## 目录

| 文件 | 内容 |
|---|---|
| [overview.md](overview.md) | 目标、核心设计（前缀冻结）、与参考项目 aidea 的根本差异 |
| [architecture.md](architecture.md) | iframe 边界、两侧职责划分、数据流、目录结构 |
| [environment.md](environment.md) | Zotero 运行环境的约束与坑。踩过的每一个都在这里 |
| [development.md](development.md) | 构建管线、开发回路、探针、常见问题排查 |
| [ui.md](ui.md) | Notion 设计规则、设计 token、主题桥接、组件层约定 |
| [zotero-integration.md](zotero-integration.md) | section 注册、本地化、图标、高度自适应 |
| [roadmap.md](roadmap.md) | 里程碑状态与未完成项 |
| [adr/](adr/) | 架构决策记录：每个决策的背景、取舍、证据 |

## 文档维护约定

**证据优先。** 涉及运行时行为的断言要附上验证方式——探针输出、日志、或
Zotero 源码位置。这个项目的大部分时间花在"看起来应该可以但实际不行"上，
没有证据的结论会让后来人重走一遍。

**记录失败路径。** [environment.md](environment.md) 里每一条都对应一次真实的
调试。删掉"已经修好的坑"等于让下一个人重踩。

**决策写进 ADR。** 换技术方案、放弃某条路、接受某个取舍，都补一份
[adr/](adr/)。代码能表达"是什么"，表达不了"为什么不是另一种"。

**改了代码就改文档。** 尤其是 [architecture.md](architecture.md) 的目录结构表
和 [roadmap.md](roadmap.md) 的状态。
