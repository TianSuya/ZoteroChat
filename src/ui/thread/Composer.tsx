import { AuiIf, ComposerPrimitive } from "@assistant-ui/react";
import { ArrowUp, Square, X } from "lucide-react";

import { Button } from "../components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";
import { usePanelCopy } from "../ReplyLanguage";
import { SlashMenu } from "./SlashMenu";

export type SelectionChip = {
  text: string;
  page?: number;
};

function SelectionBanner({
  selection,
  onClear,
  clearLabel,
  label,
}: {
  selection: SelectionChip;
  onClear?: () => void;
  clearLabel: string;
  label: string;
}) {
  const snippet =
    selection.text.length > 140
      ? `${selection.text.slice(0, 140).trimEnd()}…`
      : selection.text;
  return (
    <div className="mb-1.5 flex items-start gap-1 rounded bg-surface px-1.5 py-1">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-fg-faint">
          {label}
          {selection.page != null ? ` · p.${selection.page}` : ""}
        </p>
        <p className="text-sm leading-relaxed text-fg-muted">{snippet}</p>
      </div>
      {onClear ? (
        <Button
          size="icon"
          className="mt-px h-5 w-5 shrink-0"
          aria-label={clearLabel}
          onClick={onClear}
        >
          <X size={12} strokeWidth={1.5} />
        </Button>
      ) : null}
    </div>
  );
}

/**
 * ChatGPT composer, squeezed to Notion: auto-growing textarea, send on
 * Enter / stop while running, slash palette above the field. The send
 * control sits on the last line so a one-line draft stays a single row.
 */
export function Composer({
  selection,
  onClearSelection,
  placeholder,
}: {
  selection?: SelectionChip | null;
  onClearSelection?: () => void;
  placeholder?: string;
}) {
  const copy = usePanelCopy();
  return (
    <ComposerPrimitive.Root
      compact
      className="relative rounded-md bg-surface-subtle px-2 py-1.5"
    >
      <SlashMenu />
      {selection ? (
        <SelectionBanner
          selection={selection}
          onClear={onClearSelection}
          clearLabel={copy.clearSelection}
          label={copy.selectionLabel}
        />
      ) : null}
      <div className="flex items-end gap-1">
        <ComposerPrimitive.Input
          rows={1}
          minRows={1}
          maxRows={8}
          autoFocus
          submitMode="enter"
          placeholder={
            placeholder ??
            (selection
              ? copy.composerPlaceholderSelection
              : copy.composerPlaceholder)
          }
          className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-0.5 text-base text-fg outline-none placeholder:text-fg-faint"
        />
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <Tooltip>
            <TooltipTrigger asChild>
              <ComposerPrimitive.Send asChild>
                <Button
                  variant="primary"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  aria-label={copy.send}
                >
                  <ArrowUp size={14} strokeWidth={1.5} />
                </Button>
              </ComposerPrimitive.Send>
            </TooltipTrigger>
            <TooltipContent>{copy.send}</TooltipContent>
          </Tooltip>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <Tooltip>
            <TooltipTrigger asChild>
              <ComposerPrimitive.Cancel asChild>
                <Button
                  variant="subtle"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  aria-label={copy.stop}
                >
                  <Square size={10} strokeWidth={2} fill="currentColor" />
                </Button>
              </ComposerPrimitive.Cancel>
            </TooltipTrigger>
            <TooltipContent>{copy.stop}</TooltipContent>
          </Tooltip>
        </AuiIf>
      </div>
    </ComposerPrimitive.Root>
  );
}
