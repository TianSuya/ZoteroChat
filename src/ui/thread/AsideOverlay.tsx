import {
  AssistantRuntimeProvider,
  AuiIf,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { ArrowDown, ArrowLeft } from "lucide-react";
import { useEffect } from "react";

import type { BridgeUsage, PanelBridge } from "../../panel-app/bridge";
import { useAsideRuntime } from "../../runtime/asideStore";
import type { StoredMessage } from "../../runtime/externalStore";
import { Button } from "../components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/tooltip";
import { usePanelCopy } from "../ReplyLanguage";
import { AssistantMessage } from "./AssistantMessage";
import { Composer } from "./Composer";
import { CostBar } from "./CostBar";
import { UserMessage } from "./UserMessage";

export function AsideOverlay({
  bridge,
  asideId,
  quote,
  messages,
  setMessages,
  charCount,
  paperError,
  paperLoading,
  onClose,
}: {
  bridge: PanelBridge;
  asideId: string;
  quote: string;
  messages: StoredMessage[];
  setMessages: (
    next: StoredMessage[] | ((prev: StoredMessage[]) => StoredMessage[]),
  ) => void;
  charCount?: number;
  paperError?: string | null;
  paperLoading?: boolean;
  onClose: () => void;
}) {
  const { runtime, view } = useAsideRuntime(
    bridge,
    asideId,
    messages,
    setMessages,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <TooltipProvider delayDuration={200}>
        <AsideChrome
          quote={quote}
          onClose={onClose}
          usage={view.usage}
          prefixBreak={view.prefixBreak}
          charCount={charCount}
          paperError={paperError}
          paperLoading={paperLoading}
        />
      </TooltipProvider>
    </AssistantRuntimeProvider>
  );
}

function AsideChrome({
  quote,
  onClose,
  usage,
  prefixBreak,
  charCount,
  paperError,
  paperLoading,
}: {
  quote: string;
  onClose: () => void;
  usage: BridgeUsage | null;
  prefixBreak: boolean;
  charCount?: number;
  paperError?: string | null;
  paperLoading?: boolean;
}) {
  const copy = usePanelCopy();
  return (
    <div className="zc-aside-overlay absolute inset-0 z-20 flex min-h-0 flex-col bg-surface">
      <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col bg-surface">
        <header className="flex h-8 shrink-0 items-center gap-1 px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                className="h-6 gap-0.5 px-1.5 text-sm text-fg"
                aria-label={copy.asideBack}
                onClick={onClose}
              >
                <ArrowLeft size={14} strokeWidth={1.5} />
                {copy.asideBack}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copy.asideBack}</TooltipContent>
          </Tooltip>
          <span className="truncate text-sm font-medium text-fg-muted">
            {copy.asideTitle}
          </span>
        </header>

        <div className="shrink-0 px-3 pb-2">
          <div className="rounded-r border-l-2 border-accent bg-surface-subtle py-1.5 pl-2 pr-2">
            <p className="text-xs text-fg-faint">{copy.asideQuoteLabel}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-muted">
              {quote}
            </p>
          </div>
        </div>

        <ThreadPrimitive.Viewport className="zc-scroll relative flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <p className="py-4 text-sm text-fg-faint">{copy.asideEmpty}</p>
          </AuiIf>
          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage,
            }}
          />
          <ThreadPrimitive.ScrollToBottom className="sticky bottom-2 z-10 mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md bg-surface-raised text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg">
            <ArrowDown size={14} strokeWidth={1.5} />
          </ThreadPrimitive.ScrollToBottom>
        </ThreadPrimitive.Viewport>

        <footer className="shrink-0 px-3 pb-2 pt-1">
          <Composer placeholder={copy.asidePlaceholder} />
          <CostBar
            usage={usage}
            charCount={charCount}
            prefixBreak={prefixBreak}
            paperError={paperError}
            paperLoading={paperLoading}
          />
        </footer>
      </ThreadPrimitive.Root>
    </div>
  );
}
