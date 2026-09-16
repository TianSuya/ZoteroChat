# ZoteroChat

Zotero 侧边栏论文阅读助手。以打开的 PDF 附件为会话边界，把全文常驻上下文，
用前缀冻结换取高缓存命中率。

> 状态：开发中。面板骨架已跑通（M1），LLM 链路尚未接入。
> 详见 [docs/roadmap.md](docs/roadmap.md)。

## 快速开始

```bash
npm install
curl -sL -o fixtures/attention.pdf https://arxiv.org/pdf/1706.03762v7
cp .env.example .env     # 按需改路径
npm start
```

`npm start` 会拉起一个独立的 Zotero 实例（独立 profile 和数据目录），
不影响你自己在用的 Zotero 和文献库。

## 文档

**→ [docs/](docs/)**

| | |
|---|---|
| [概览](docs/overview.md) | 目标、核心设计、与 aidea 的差异 |
| [系统结构](docs/architecture.md) | iframe 边界、两侧职责、数据流 |
| [运行环境](docs/environment.md) | Zotero 环境的坑，**遇到怪问题先看这里** |
| [开发指南](docs/development.md) | 构建、开发回路、探针、排查 |
| [UI 约定](docs/ui.md) | 设计规则、token、组件层 |
| [Zotero 集成](docs/zotero-integration.md) | section 注册、本地化、图标 |
| [架构决策](docs/adr/) | 为什么不是另一种做法 |

## 许可

未定。
