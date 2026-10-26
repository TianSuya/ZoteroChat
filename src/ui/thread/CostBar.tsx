import { formatUsage } from "../../llm/usage";
import type { BridgeUsage } from "../../panel-app/bridge";

export function CostBar({
  mode = "paper",
  noteName,
  noteChars,
  usage,
  charCount,
  prefixBreak,
  paperError,
  paperLoading,
}: {
  mode?: "paper" | "note";
  noteName?: string;
  noteChars?: number;
  usage: BridgeUsage | null;
  charCount?: number;
  prefixBreak?: boolean;
  paperError?: string | null;
  paperLoading?: boolean;
}) {
  const text =
    mode === "note"
      ? usage
        ? `${formatUsage(usage, {})} · Note`
        : `Note · ${noteName ?? "Untitled note"}${
            noteChars != null ? ` · ${noteChars.toLocaleString()} chars` : ""
          }`
      : paperLoading
        ? "Reading paper…"
        : formatUsage(usage, {
            charCount,
            prefixBreak,
            paperError: paperError ?? undefined,
          });
  return (
    <p
      className={
        paperError || prefixBreak
          ? "mt-1 min-w-0 truncate px-0.5 text-xs text-danger"
          : "mt-1 min-w-0 truncate px-0.5 text-xs text-fg-faint"
      }
    >
      {text}
    </p>
  );
}
