import { formatUsage } from "../../llm/usage";
import type { BridgeUsage } from "../../panel-app/bridge";

export function CostBar({
  usage,
  charCount,
  prefixBreak,
  paperError,
  paperLoading,
}: {
  usage: BridgeUsage | null;
  charCount?: number;
  prefixBreak?: boolean;
  paperError?: string | null;
  paperLoading?: boolean;
}) {
  const text = paperLoading
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
          ? "mt-1 px-0.5 text-xs text-danger"
          : "mt-1 px-0.5 text-xs text-fg-faint"
      }
    >
      {text}
    </p>
  );
}
