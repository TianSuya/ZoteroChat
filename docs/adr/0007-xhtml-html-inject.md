# 0007. 面板里的 HTML 必须经 HTML 解析器注入

**状态**：已采纳
**日期**：2026-09

## 背景

对话面板是 `chrome://zoterochat/content/panel.xhtml`，文档类型是 **XHTML**。
助手回复用 markdown-it + KaTeX MathML 生成 HTML 字符串。最初用 React 的
`dangerouslySetInnerHTML` 写入。

## 决策

禁止对面板 DOM 赋 `innerHTML`。用 `DOMParser` 以 `text/html` 解析，再
`importNode` 进 XHTML 文档（`src/ui/markdown/setHtml.ts`）。

KaTeX 的 `<annotation>`（TeX 源）不含 XML 转义，注入前剥掉。

## 理由

XHTML 的 `innerHTML` 走 XML 解析器。MathML 的命名空间、注解里的 `&` / `<` 会抛
`InvalidCharacterError: An invalid or illegal string was specified`，整块面板被
ErrorBoundary 卸掉。

`text/html` 解析器更宽松；`importNode` 把节点迁进面板 document。

放弃的选项：

- 把 `panel.xhtml` 改成 `panel.html`：会牵动 chrome 注册与 Fluent，收益不足以覆盖风险。
- 继续 `innerHTML` 并手工把 KaTeX 输出修成合法 XML：公式种类太多，守不住。

## 代价

多一次 parse + import。流式时对 markdown+KaTeX 做了约 48ms 节流。

排查写法见 [environment.md §9](../environment.md#九xhtml-面板不能-innerhtml-灌-html--mathml)。

## 证据

- 含公式的回复触发 ErrorBoundary，日志为上述 InvalidCharacterError。
- `importNode` 若不移走源节点、却 `while (body.firstChild)` 循环，会无限克隆，
  实测吃掉 70GB+ 内存。必须 `Array.from(childNodes)` 有限拷贝。
- 单元测试：`src/ui/markdown/render.test.ts` 断言剥掉会破坏 XHTML 的 TeX annotation。
