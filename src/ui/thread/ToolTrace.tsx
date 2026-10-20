import {
  BookPlus,
  CircleCheck,
  CircleX,
  Globe,
  Loader2,
  MessageCircleQuestion,
  Search,
} from "lucide-react";

import type { ToolTrace } from "../../llm/types";
import { usePanelCopy } from "../ReplyLanguage";

function iconFor(name: string) {
  switch (name) {
    case "search_web":
      return Search;
    case "fetch_url":
      return Globe;
    case "add_paper_to_zotero":
      return BookPlus;
    case "ask_user":
      return MessageCircleQuestion;
    default:
      return Search;
  }
}

function labelFor(name: string, copy: ReturnType<typeof usePanelCopy>): string {
  switch (name) {
    case "search_web":
      return copy.toolSearch;
    case "fetch_url":
      return copy.toolFetch;
    case "add_paper_to_zotero":
      return copy.toolAddPaper;
    case "ask_user":
      return copy.toolAskUser;
    default:
      return name;
  }
}

function StatusIcon({ status }: { status: ToolTrace["status"] }) {
  if (status === "running") {
    return (
      <Loader2
        size={12}
        strokeWidth={1.5}
        className="mt-0.5 shrink-0 animate-spin text-fg-faint"
      />
    );
  }
  if (status === "error") {
    return (
      <CircleX
        size={12}
        strokeWidth={1.5}
        className="mt-0.5 shrink-0 text-danger"
      />
    );
  }
  return (
    <CircleCheck
      size={12}
      strokeWidth={1.5}
      className="mt-0.5 shrink-0 text-fg-faint"
    />
  );
}

/** Compact, read-only record of the tools used for one assistant reply. */
export function ToolTraceList({ trace }: { trace: ToolTrace[] }) {
  const copy = usePanelCopy();
  if (!trace.length) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-0.5">
      {trace.map((item) => {
        const Icon = iconFor(item.name);
        return (
          <div
            key={item.id}
            className="flex min-w-0 items-start gap-1 text-xs leading-relaxed text-fg-faint"
          >
            <Icon size={12} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            <span className="shrink-0">{labelFor(item.name, copy)}</span>
            <span className="min-w-0 truncate text-fg-muted">{item.title}</span>
            {item.status === "running" ? (
              <span className="shrink-0">{copy.toolRunning}…</span>
            ) : null}
            {item.status === "ok" && item.detail ? (
              <span className="min-w-0 truncate text-fg-faint">
                {item.detail}
              </span>
            ) : null}
            {item.status === "error" && item.detail ? (
              <span className="min-w-0 truncate text-danger">
                {item.detail}
              </span>
            ) : null}
            <StatusIcon status={item.status} />
          </div>
        );
      })}
    </div>
  );
}
