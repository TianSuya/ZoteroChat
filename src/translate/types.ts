export const TRANSLATE_ENGINES = [
  "google",
  "deepl",
  "google-cloud",
  "azure",
  "chat-model",
] as const;

export type TranslateEngine = (typeof TRANSLATE_ENGINES)[number];

export type TranslateResult =
  | { ok: true; text: string }
  | {
      ok: false;
      code: "missing-key" | "network" | "http" | "parse" | "empty" | "aborted";
      detail?: string;
    };

export type TranslateRequest = {
  text: string;
  target: string;
  signal?: AbortSignal;
};

export function isTranslateEngine(value: string): value is TranslateEngine {
  return (TRANSLATE_ENGINES as readonly string[]).includes(value);
}

export const MAX_TRANSLATE_CHARS = 4500;
