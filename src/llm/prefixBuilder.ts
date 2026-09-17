import type { ReplyLanguage } from "../i18n/languages";
import { turnDirectivesFor } from "../i18n/directives";
import { ACK_TEXT, SYSTEM_PROMPT } from "./prompts";
import type { ChatMessage, Selection } from "./types";

export function buildPaperUserMessage(metadata: string, text: string): string {
  const head = metadata.trim();
  const body = text.trim();
  const inner = head ? `${head}\n\n${body}` : body;
  return `<document>\n${inner}\n</document>`;
}

export function buildCurrentUserMessage(
  question: string,
  selection: Selection | null | undefined,
  language: ReplyLanguage,
): string {
  const parts: string[] = [];
  // Directives first so the language lock is not buried after a long
  // question. This is still the suffix of the request, so the frozen
  // paper prefix stays byte-identical.
  parts.push(
    `<turn-directives>\n${turnDirectivesFor(language)}\n</turn-directives>`,
  );
  const sel = selection?.text.trim();
  if (sel) {
    const page =
      selection?.page != null ? ` page="${String(selection.page)}"` : "";
    parts.push(
      `<selection${page}>\nUSER_SELECTED_PASSAGE (current PDF highlight, not the full paper)\n${sel}\n</selection>`,
    );
  }
  parts.push(`<question>\n${question.trim()}\n</question>`);
  return parts.join("\n\n");
}

export function frozenPrefix(metadata: string, text: string): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildPaperUserMessage(metadata, text) },
    { role: "assistant", content: ACK_TEXT },
  ];
}

export function buildRequestMessages(opts: {
  prefix: ChatMessage[];
  turns: ChatMessage[];
  question: string;
  selection?: Selection | null;
  language: ReplyLanguage;
}): ChatMessage[] {
  return [
    ...opts.prefix,
    ...opts.turns,
    {
      role: "user",
      content: buildCurrentUserMessage(
        opts.question,
        opts.selection,
        opts.language,
      ),
    },
  ];
}
