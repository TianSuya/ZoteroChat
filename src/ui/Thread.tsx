import { AuiIf, ThreadPrimitive } from "@assistant-ui/react";
import { ArrowDown, MessageSquarePlus, Settings } from "lucide-react";

import { Button } from "./components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/tooltip";
import { AssistantMessage } from "./thread/AssistantMessage";
import type { BridgeUsage } from "../panel-app/bridge";
import { Composer, type SelectionChip } from "./thread/Composer";
import { CostBar } from "./thread/CostBar";
import { UserMessage } from "./thread/UserMessage";
import { usePanelCopy } from "./ReplyLanguage";
import { Welcome } from "./thread/Welcome";

export type { SelectionChip };

export interface ThreadProps {
  paperTitle: string;
  onNewConversation?: () => void;
  onOpenSettings?: () => void;
  selection?: SelectionChip | null;
  onClearSelection?: () => void;
  usage?: BridgeUsage | null;
  charCount?: number;
  prefixBreak?: boolean;
  paperError?: string | null;
  paperLoading?: boolean;
  /** Dev-only probes, rendered outside the thread chrome. */
  children?: React.ReactNode;
}

/**
 * The conversation surface.
 *
 * Layout is ChatGPT's: a scrolling transcript with a composer pinned to the
 * bottom. Visual language is Notion's: no bubbles, no card chrome, hover-reveal
 * actions, 3–4px radii. Interaction is assistant-ui's primitives — we only
 * supply the classes.
 */
export function Thread({
  paperTitle,
  onNewConversation,
  onOpenSettings,
  selection,
  onClearSelection,
  usage = null,
  charCount,
  prefixBreak,
  paperError,
  paperLoading,
  children,
}: ThreadProps) {
  const copy = usePanelCopy();
  return (
    <TooltipProvider delayDuration={200}>
      <ThreadPrimitive.Root className="group flex h-full min-h-0 flex-col bg-surface">
        <header className="flex h-8 shrink-0 items-center gap-1 px-2">
          <span
            className="truncate text-sm font-medium text-fg-muted"
            title={paperTitle}
          >
            {paperTitle}
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <AuiIf condition={(s) => !s.thread.isEmpty}>
              <span className="zc-reveal inline-flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      aria-label={copy.newConversation}
                      onClick={onNewConversation}
                    >
                      <MessageSquarePlus size={14} strokeWidth={1.5} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{copy.newConversation}</TooltipContent>
                </Tooltip>
              </span>
            </AuiIf>
            {onOpenSettings ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    aria-label={copy.settings}
                    onClick={onOpenSettings}
                  >
                    <Settings size={14} strokeWidth={1.5} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{copy.settings}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </header>

        <ThreadPrimitive.Viewport className="zc-scroll relative flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <div className="flex min-h-0 flex-1 flex-col justify-center">
              <Welcome />
            </div>
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
          <Composer selection={selection} onClearSelection={onClearSelection} />
          <CostBar
            usage={usage}
            charCount={charCount}
            prefixBreak={prefixBreak}
            paperError={paperError}
            paperLoading={paperLoading}
          />
        </footer>

        {children}
      </ThreadPrimitive.Root>
    </TooltipProvider>
  );
}
