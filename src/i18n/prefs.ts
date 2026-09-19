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
    true,
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
    true,
  );
  return () => Zotero.Prefs.unregisterObserver(symbol);
}

const appliedListeners = new Set<() => void>();

export function onPrefsApplied(listener: () => void): () => void {
  appliedListeners.add(listener);
  return () => appliedListeners.delete(listener);
}

export function notifyPrefsApplied(): void {
  for (const listener of appliedListeners) listener();
}
