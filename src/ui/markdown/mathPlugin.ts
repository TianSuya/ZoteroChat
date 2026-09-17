import type MarkdownIt from "markdown-it";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import katex from "katex";

function katexHtml(tex: string, displayMode: boolean): string {
  const html = katex.renderToString(tex, {
    displayMode,
    throwOnError: false,
    output: "mathml",
    strict: "ignore",
    trust: false,
  });
  // TeX source in <annotation> is not XML-escaped (`x < y`, `a & b`).
  return html.replace(/<annotation\b[^>]*>[\s\S]*?<\/annotation>/g, "");
}

function isOpenDelim(src: string, pos: number): boolean {
  const prev = pos > 0 ? src.charCodeAt(pos - 1) : 32;
  const next = pos + 1 < src.length ? src.charCodeAt(pos + 1) : 32;
  if (next === 32 || next === 10) return false;
  if (prev >= 48 && prev <= 57 && next !== 32) return false;
  return true;
}

function isCloseDelim(src: string, pos: number): boolean {
  const prev = pos > 0 ? src.charCodeAt(pos - 1) : 32;
  const next = pos + 1 < src.length ? src.charCodeAt(pos + 1) : 32;
  if (prev === 32 || prev === 10) return false;
  if (next >= 48 && next <= 57) return false;
  return true;
}

function mathInline(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const start = state.pos;
  if (start >= state.posMax) return false;

  if (src.startsWith("\\(", start)) {
    const end = src.indexOf("\\)", start + 2);
    if (end < 0) return false;
    if (!silent) {
      const token = state.push("math_inline", "math", 0);
      token.content = src.slice(start + 2, end).trim();
      token.markup = "\\(";
    }
    state.pos = end + 2;
    return true;
  }

  if (src[start] !== "$") return false;
  if (src[start + 1] === "$") return false;
  if (!isOpenDelim(src, start)) return false;

  let pos = start + 1;
  let found = -1;
  while (pos < state.posMax) {
    const ch = src[pos];
    if (ch === "\\" && pos + 1 < state.posMax) {
      pos += 2;
      continue;
    }
    if (ch === "$" && isCloseDelim(src, pos)) {
      found = pos;
      break;
    }
    pos += 1;
  }
  if (found < 0) return false;
  const content = src.slice(start + 1, found);
  if (!content.trim()) return false;

  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.content = content;
    token.markup = "$";
  }
  state.pos = found + 1;
  return true;
}

function mathBlock(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  const max = state.eMarks[startLine]!;
  const line = state.src.slice(start, max);

  const open = line.startsWith("$$")
    ? "$$"
    : line.startsWith("\\[")
      ? "\\["
      : null;
  if (!open) return false;

  const close = open === "$$" ? "$$" : "\\]";
  const afterOpen = line.slice(open.length);

  const collect = (fromLine: number, firstRest: string): string | null => {
    if (firstRest.includes(close)) {
      return firstRest.slice(0, firstRest.indexOf(close)).trim();
    }
    const parts = [firstRest];
    let next = fromLine + 1;
    while (next < endLine) {
      const s = state.bMarks[next]! + state.tShift[next]!;
      const e = state.eMarks[next]!;
      const body = state.src.slice(s, e);
      if (body.includes(close)) {
        parts.push(body.slice(0, body.indexOf(close)));
        return parts.join("\n").trim();
      }
      parts.push(body);
      next += 1;
    }
    return null;
  };

  const content = collect(startLine, afterOpen);
  if (content === null) return false;

  if (silent) return true;

  let end = startLine;
  if (!afterOpen.includes(close)) {
    end = startLine + 1;
    while (end < endLine) {
      const s = state.bMarks[end]! + state.tShift[end]!;
      const e = state.eMarks[end]!;
      if (state.src.slice(s, e).includes(close)) break;
      end += 1;
    }
  }

  const token = state.push("math_block", "math", 0);
  token.block = true;
  token.content = content;
  token.markup = open;
  token.map = [startLine, end + 1];
  state.line = end + 1;
  return true;
}

export function mathPlugin(md: MarkdownIt): void {
  md.inline.ruler.before("escape", "math_inline", mathInline);
  md.block.ruler.before("fence", "math_block", mathBlock, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  md.renderer.rules.math_inline = (tokens, idx) =>
    katexHtml(tokens[idx]!.content, false);
  md.renderer.rules.math_block = (tokens, idx) =>
    `<div class="zc-md-eq">${katexHtml(tokens[idx]!.content, true)}</div>\n`;
}
