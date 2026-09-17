import {
  ActionBarPrimitive,
  AuiIf,
  MessagePrimitive,
} from "@assistant-ui/react";
import { Check, Copy } from "lucide-react";

import { Button } from "../components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";
import { MarkdownText } from "../markdown/MarkdownText";

/**
 * Assistant copy is naked body text. Actions hover-reveal, except on the
 * last message where ChatGPT keeps them reachable without hunting.
 *
 * Edit / branch / delete are omitted on purpose — the runtime does not
 * advertise those capabilities (ADR 0004).
 */
export function AssistantMessage() {
  return (
    <MessagePrimitive.Root
      data-zc-message="assistant"
      className="group/msg relative mb-4"
    >
      <div className="text-base text-fg">
        <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
        <AuiIf
          condition={(s) => Boolean(s.thread.isRunning && s.message.isLast)}
        >
          <span className="zc-caret" aria-hidden="true" />
        </AuiIf>
      </div>

      <ActionBarPrimitive.Root
        hideWhenRunning
        autohide="not-last"
        className="mt-1 flex items-center gap-0.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ActionBarPrimitive.Copy asChild>
              <Button size="icon" aria-label="Copy">
                <Copy size={14} strokeWidth={1.5} className="zc-copy-icon" />
                <Check size={14} strokeWidth={1.5} className="zc-copied-icon" />
              </Button>
            </ActionBarPrimitive.Copy>
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>
      </ActionBarPrimitive.Root>
    </MessagePrimitive.Root>
  );
}
