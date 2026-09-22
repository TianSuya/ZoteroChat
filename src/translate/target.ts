import type { UiLanguage } from "../i18n/languages";
import type { TranslateEngine } from "./types";

export function clipText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

export function targetForEngine(
  engine: TranslateEngine,
  ui: UiLanguage,
): string {
  switch (engine) {
    case "deepl":
      if (ui === "zh-CN") return "ZH-HANS";
      if (ui === "zh-TW") return "ZH-HANT";
      return ui.toUpperCase();
    case "azure":
      if (ui === "zh-CN") return "zh-Hans";
      if (ui === "zh-TW") return "zh-Hant";
      return ui;
    default:
      return ui;
  }
}
