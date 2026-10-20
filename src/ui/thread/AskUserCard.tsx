import { BookPlus, CircleHelp } from "lucide-react";
import { useEffect, useState } from "react";

import type { BridgePendingPrompt } from "../../panel-app/bridge";
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
  onAnswer: (value: string | boolean) => void;
  onSkip: () => void;
}) {
  const copy = usePanelCopy();
  const [text, setText] = useState("");

  useEffect(() => {
    setText("");
  }, [prompt]);

  if (!prompt) return null;

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
        <div className="mt-1.5 flex flex-wrap gap-1">
          {prompt.options.map((option) => (
            <Button
              key={option}
              size="sm"
              variant="subtle"
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
