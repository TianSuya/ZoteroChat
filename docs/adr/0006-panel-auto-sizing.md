# 0006. 面板高度自适应 item pane

**状态**：已采纳
**日期**：2026-09

## 背景

item pane 的 section 是**按内容高度撑开**的，所以面板必须自带像素高度——
百分比高度会塌成 0（父容器没有确定高度）。

试过三个版本，前两个都不对：

**写死 420px。** 和侧边栏实际高度无关，下面空一块或者溢出。

**显式高度 + CSS `resize: vertical` + 持久化**（参考 aidea 的 `heightSync.ts`）。
能用，但用户得自己拖。而且 item pane 本身已经能拖宽窄了，再加一套是冗余。

**填满视口高度**（`viewport.clientHeight`）。上方还有其他 section，面板从 y≈293
开始又高 922px，整体溢出视口，composer 被挤到看不见。

## 决策

不变量：**面板底边始终与 item pane 底边对齐**。

```ts
room(offset) = viewport.clientHeight - max(0, offset) - chrome - GUTTER;

atRest = room(contentTop); // 滚动无关
available = max(room(visibleTop), atRest);
height = max(MIN_HEIGHT, round(available));
```

## 理由

有两种状态都要满足，而且它们要的高度不同：

- **静止**：被上方 section 推下来 → 填满剩余空间
- **点 sidenav 图标**：Zotero 调 `scrollToPane` 把 section 滚到顶 → 填满整个面板

两者都是"底边对齐底边"，所以必须用**可见偏移量**（随滚动变化），不能用内容偏移量。

### 为什么需要下界

可见偏移量会形成反馈回路：

```
面板变矮 → 滚动内容变矮 → 浏览器夹低 scrollTop
        → 可见偏移量变大 → 面板更矮 → ...
```

滚到底时会一路缩到 `MIN_HEIGHT`。

下界取**滚动无关的自然高度**。因为 `scrollTop >= 0`，可见偏移量恒不大于内容偏移量，
所以 `room(visibleTop) >= room(contentTop)` 恒成立——自然高度永远是合法下界，
而且它正是未滚动时的正确答案。收缩到那里就停住。

### 这条路径确实会被走到

Zotero 的 `_getMinScrollHeightForPane` 会给容器加底部 padding，让目标 section
**能够**滚到顶。所以"section 在视口顶部"不是假想状态。

## 代价

- 要监听的东西不少：viewport resize、section resize、pane scroll、以及兄弟 section
  展开/折叠（后者是属性变化，得用 MutationObserver）
- 用户无法手动指定高度

## 证据

`dev/checkSizing.ts`，两种状态：

| 状态   | scrollTop | section 距顶 | 面板高 | **底部间隙** |
| ------ | --------- | ------------ | ------ | ------------ |
| 静止   | 0         | 293          | 590    | **8**        |
| 滚到顶 | 293       | 0            | 882    | **8**        |

底部间隙两种状态一致，不变量成立。（滚到顶时 `scrollHeight` 从 920 涨到 1213，
正好是 Zotero 加的 padding。）

**未实测**：窗口缩放、拖动 item pane 分栏、兄弟 section 展开折叠。只验证了
observer 已挂载和初始计算正确。

## 实现坑

`item-pane-custom-section` 是 XUL 元素，**没有 `offsetHeight`**。读出 `undefined`
后参与算术变成 NaN，而 `NaN !== NaN` 让"值没变就跳过"的守卫永远不成立，observer
无限重算。必须用 `getBoundingClientRect()`。

Zotero 自己的代码里也有同样的注释和 workaround。
