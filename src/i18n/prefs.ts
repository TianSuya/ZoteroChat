import { config } from "../../package.json";
import {
  parseReplyLanguage,
  resolveUiLanguage,
  type ReplyLanguage,
  type UiLanguage,
} from "./languages";

export function readReplyLanguage(): ReplyLanguage {
  return parseReplyLanguage(
    Zotero.Prefs.get(`${config.prefsPrefix}.replyLanguage`, true),
  );
}

export function readUiLanguage(): UiLanguage {
  return resolveUiLanguage(readReplyLanguage(), String(Zotero.locale ?? ""));
}

export function onUiLanguageChange(
  listener: (lang: UiLanguage) => void,
): () => void {
  const symbol = Zotero.Prefs.registerObserver(
    `${config.prefsPrefix}.replyLanguage`,
    () => listener(readUiLanguage()),
  );
  return () => Zotero.Prefs.unregisterObserver(symbol);
}

export function readFontSize(): number {
  const n = Number(Zotero.Prefs.get(`${config.prefsPrefix}.fontSize`, true));
  if (!Number.isFinite(n)) return 14;
  return Math.min(18, Math.max(12, Math.round(n)));
}

export function onFontSizeChange(listener: (size: number) => void): () => void {
  const symbol = Zotero.Prefs.registerObserver(
    `${config.prefsPrefix}.fontSize`,
    () => listener(readFontSize()),
  );
  return () => Zotero.Prefs.unregisterObserver(symbol);
}
