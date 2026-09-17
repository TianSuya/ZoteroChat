import { useAui, useAuiState } from "@assistant-ui/react";

import { matchingCommands, slashQuery } from "../../i18n/commands";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "../components/command";
import { usePanelCopy, useUiLanguage } from "../ReplyLanguage";

export function SlashMenu() {
  const aui = useAui();
  const lang = useUiLanguage();
  const copy = usePanelCopy();
  const text = useAuiState((s) => s.composer.text);
  const query = slashQuery(text);
  if (query === null) return null;

  const items = matchingCommands(query, lang);
  return (
    <div className="absolute inset-x-0 bottom-full z-20 mb-1 overflow-hidden rounded-md border border-border bg-surface-raised">
      <Command
        label={copy.slashLabel}
        shouldFilter={false}
        className="bg-surface-raised"
      >
        <CommandList>
          {items.length === 0 ? (
            <CommandEmpty>{copy.slashEmpty}</CommandEmpty>
          ) : (
            items.map((cmd) => (
              <CommandItem
                key={cmd.id}
                value={cmd.id}
                onSelect={() => {
                  aui.composer.setText(cmd.prompt);
                  aui.composer.send();
                }}
              >
                <span className="text-fg-faint">/{cmd.slash}</span>
                <span className="truncate text-fg-muted">{cmd.hint}</span>
              </CommandItem>
            ))
          )}
        </CommandList>
      </Command>
    </div>
  );
}
