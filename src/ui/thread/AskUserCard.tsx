import { BookPlus, CircleHelp, ListChecks } from "lucide-react";
import { useEffect, useState } from "react";

import type {
  BridgePaperBatchDecision,
  BridgePendingPrompt,
} from "../../panel-app/bridge";
import { usePanelCopy } from "../ReplyLanguage";
import { Button } from "../components/button";

/**
 * One prompt card shared by both directions: a model question and the
 * confirmation before a paper is written to the library.
 */
export function AskUserCard({
  prompt,
  onAnswer,
  onSkip,
}: {
  prompt: BridgePendingPrompt | null;
  onAnswer: (value: string | boolean | BridgePaperBatchDecision) => void;
  onSkip: () => void;
}) {
  const copy = usePanelCopy();
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    setText("");
    setSelected(
      prompt?.kind === "papers"
        ? new Set(prompt.papers.map((_, index) => index))
        : new Set(),
    );
  }, [prompt]);

  if (!prompt) return null;

  if (prompt.kind === "papers") {
    const toggle = (index: number) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    };
    return (
      <div className="mb-1.5 rounded-md border border-border bg-surface-raised p-2">
        <div className="flex items-center gap-1 text-xs text-fg-faint">
          <ListChecks size={13} strokeWidth={1.5} />
          <span>{copy.paperBatchLabel ?? "Select papers"}</span>
        </div>
        {prompt.note ? (
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">
            {prompt.note}
          </p>
        ) : null}
        <div className="mt-1.5 max-h-64 overflow-y-auto rounded border border-border bg-surface">
          {prompt.papers.map((paper, index) => (
            <label
              key={`${paper.url}-${index}`}
              className="flex cursor-pointer items-start gap-1.5 border-b border-border/60 px-1.5 py-1 last:border-b-0 hover:bg-surface-hover"
            >
              <input
                type="checkbox"
                className="mt-1 h-3 w-3 shrink-0 accent-[var(--color-accent)]"
                checked={selected.has(index)}
                onChange={() => toggle(index)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-snug text-fg">
                  {paper.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-fg-faint">
                  {[paper.year, paper.venue, paper.doi]
                    .filter(Boolean)
                    .join(" · ") || "metadata pending"}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <Button
            size="sm"
            variant="primary"
            disabled={selected.size === 0}
            onClick={() =>
              onAnswer({
                action: "add",
                selected: prompt.papers.filter((_, index) =>
                  selected.has(index),
                ),
              })
            }
          >
            {copy.paperBatchAdd ?? "Add selected"} · {selected.size}
          </Button>
          <Button size="sm" onClick={() => onAnswer({ action: "cancel" })}>
            {copy.paperConfirmCancel}
          </Button>
        </div>
      </div>
    );
  }

  if (prompt.kind === "paper") {
    const host = (() => {
      try {
        return new URL(prompt.url).hostname;
      } catch {
        return prompt.url;
      }
    })();
    return (
      <div className="mb-1.5 rounded-md border border-border bg-surface-raised p-2">
        <div className="flex items-center gap-1 text-xs text-fg-faint">
          <BookPlus size={13} strokeWidth={1.5} />
          <span>{copy.paperConfirmLabel}</span>
        </div>
        <p className="mt-1 break-words text-sm font-medium text-fg">
          {prompt.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-fg-faint" title={prompt.url}>
          {host}
          {prompt.doi ? ` · ${prompt.doi}` : ""}
          {prompt.year ? ` · ${prompt.year}` : ""}
        </p>
        {prompt.authors?.length ? (
          <p className="mt-0.5 truncate text-xs text-fg-faint">
            {prompt.authors.slice(0, 4).join(", ")}
            {prompt.authors.length > 4 ? " et al." : ""}
          </p>
        ) : null}
        <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
          {copy.paperConfirmBody}
        </p>
        <div className="mt-1.5 flex items-center gap-1">
          <Button size="sm" variant="primary" onClick={() => onAnswer(true)}>
            {copy.paperConfirmAdd}
          </Button>
          <Button size="sm" onClick={onSkip}>
            {copy.paperConfirmCancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-1.5 rounded-md border border-border bg-surface-raised p-2">
      <div className="flex items-center gap-1 text-xs text-fg-faint">
        <CircleHelp size={13} strokeWidth={1.5} />
        <span>{copy.askUserLabel}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-fg">
        {prompt.question}
      </p>
      {prompt.options?.length ? (
        <div className="mt-1.5 flex max-h-52 flex-col gap-1 overflow-y-auto pr-1">
          {prompt.options.map((option) => (
            <Button
              key={option}
              size="sm"
              variant="subtle"
              className="h-auto w-full min-w-0 justify-start whitespace-normal break-words px-2 py-1 text-left leading-snug"
              onClick={() => onAnswer(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      ) : null}
      <textarea
        rows={2}
        autoFocus
        value={text}
        placeholder={copy.askUserPlaceholder}
        onChange={(event) => setText(event.target.value)}
        className="mt-1.5 w-full resize-none rounded bg-surface-subtle px-1.5 py-1 text-sm leading-relaxed text-fg outline-none placeholder:text-fg-faint focus-visible:ring-2 focus-visible:ring-accent/40"
      />
      <div className="mt-1.5 flex items-center gap-1">
        <Button
          size="sm"
          variant="primary"
          disabled={!text.trim()}
          onClick={() => onAnswer(text.trim())}
        >
          {copy.askUserSubmit}
        </Button>
        <Button size="sm" onClick={onSkip}>
          {copy.askUserSkip}
        </Button>
      </div>
    </div>
  );
}
