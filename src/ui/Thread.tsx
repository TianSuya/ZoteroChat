import { MessageSquarePlus, Sparkles } from "lucide-react";

import { Button } from "./components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/tooltip";

export interface ThreadProps {
  paperTitle: string;
  /** Rendered under the composer while the panel has no real runtime yet. */
  children?: React.ReactNode;
}

/**
 * Static shell for the conversation.
 *
 * Notion layout rules applied here: no card borders, no bubbles, hierarchy
 * from background and whitespace alone, and every action hidden until hover.
 */
export function Thread({ paperTitle, children }: ThreadProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="group/panel flex h-full min-h-0 flex-col bg-surface">
        <header className="flex h-8 shrink-0 items-center gap-1 px-2">
          <span
            className="truncate text-sm font-medium text-fg-muted"
            title={paperTitle}
          >
            {paperTitle}
          </span>
          <div className="ml-auto zc-reveal">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" aria-label="New conversation">
                  <MessageSquarePlus size={14} strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New conversation</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className="zc-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <div className="flex flex-col items-start gap-1 py-6 text-fg-faint">
            <Sparkles size={16} strokeWidth={1.5} />
            <p className="text-base text-fg-muted">Ask about this paper</p>
            <p className="text-sm leading-relaxed">
              The full text is already in context. Select text in the PDF to ask
              about a specific passage.
            </p>
          </div>
          {children}
        </div>

        <footer className="shrink-0 px-3 pb-2">
          <div className="rounded-md bg-surface-subtle px-2 py-1.5">
            <p className="text-base text-fg-faint">
              Ask anything… (press / for commands)
            </p>
          </div>
          <p className="mt-1 text-xs text-fg-faint">Cache — · — tok · —</p>
        </footer>
      </div>
    </TooltipProvider>
  );
}
