import type { BridgeSelection } from "../../panel-app/bridge";

const SEL_OPEN = "<<<SELECTION";
const SEL_CLOSE = ">>>";
const Q_MARK = "<<<QUESTION>>>";

/** Display-only encoding. The model payload is built separately. */
export function encodeUserContent(
  question: string,
  selection?: BridgeSelection | null,
): string {
  const q = question.trim();
  const sel = selection?.text.trim();
  if (!sel) return q;
  const page = selection?.page != null ? String(selection.page) : "";
  return `${SEL_OPEN} page="${page}"${SEL_CLOSE}\n${sel}\n${Q_MARK}\n${q}`;
}

export function parseUserContent(raw: string): {
  question: string;
  selection: BridgeSelection | null;
} {
  const match = raw.match(
    /^<<<SELECTION page="(.*)">>>\n([\s\S]*?)\n<<<QUESTION>>>\n([\s\S]*)$/,
  );
  if (!match) return { question: raw, selection: null };
  const pageNum = match[1] ? Number(match[1]) : undefined;
  return {
    selection: {
      text: match[2] ?? "",
      page: Number.isFinite(pageNum) ? pageNum : undefined,
    },
    question: match[3] ?? "",
  };
}
