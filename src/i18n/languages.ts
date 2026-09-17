export const REPLY_LANGUAGES = [
  "zh-CN",
  "zh-TW",
  "en",
  "ja",
  "ko",
  "de",
  "fr",
  "auto",
] as const;

export type ReplyLanguage = (typeof REPLY_LANGUAGES)[number];
export type UiLanguage = Exclude<ReplyLanguage, "auto">;

export function isReplyLanguage(value: string): value is ReplyLanguage {
  return (REPLY_LANGUAGES as readonly string[]).includes(value);
}

export function parseReplyLanguage(value: unknown): ReplyLanguage {
  const raw = String(value ?? "").trim();
  return isReplyLanguage(raw) ? raw : "zh-CN";
}

/** Map a Zotero locale like `zh-CN` / `en-US` onto a UI language pack. */
export function uiLanguageFromLocale(locale: string): UiLanguage {
  const loc = locale.toLowerCase().replace(/_/g, "-");
  if (
    loc.startsWith("zh-tw") ||
    loc.startsWith("zh-hk") ||
    loc.startsWith("zh-hant")
  ) {
    return "zh-TW";
  }
  if (loc.startsWith("zh")) return "zh-CN";
  if (loc.startsWith("ja")) return "ja";
  if (loc.startsWith("ko")) return "ko";
  if (loc.startsWith("de")) return "de";
  if (loc.startsWith("fr")) return "fr";
  return "en";
}

export function resolveUiLanguage(
  pref: ReplyLanguage,
  zoteroLocale?: string,
): UiLanguage {
  if (pref !== "auto") return pref;
  return uiLanguageFromLocale(zoteroLocale ?? "");
}
