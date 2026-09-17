import { ThreadPrimitive } from "@assistant-ui/react";
import { Sparkles } from "lucide-react";

import { commandsFor } from "../../i18n/commands";
import { usePanelCopy, useUiLanguage } from "../ReplyLanguage";

export function Welcome() {
  const lang = useUiLanguage();
  const copy = usePanelCopy();
  const commands = commandsFor(lang);
  return (
    <div className="flex flex-col gap-3 py-6">
      <Sparkles size={16} strokeWidth={1.5} className="text-fg-faint" />
      <div className="flex flex-col gap-1">
        <p className="text-base text-fg-muted">{copy.welcomeTitle}</p>
        <p className="text-sm leading-relaxed text-fg-faint">
          {copy.welcomeHint}
        </p>
      </div>
      <div className="flex flex-col items-stretch gap-1">
        {commands.map((cmd) => (
          <ThreadPrimitive.Suggestion
            key={cmd.id}
            prompt={cmd.prompt}
            send
            className="rounded bg-surface-subtle px-2 py-1.5 text-left text-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <span className="block text-fg">{cmd.label}</span>
            <span className="block text-xs text-fg-faint">{cmd.hint}</span>
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}
