import { config } from "../../package.json";
import { readUiLanguage } from "../i18n/prefs";
import { translateAzure } from "./engines/azure";
import { translateChatModel } from "./engines/chatModel";
import { translateDeepl } from "./engines/deepl";
import { translateGoogle } from "./engines/google";
import { translateGoogleCloud } from "./engines/googleCloud";
import { clipText, targetForEngine } from "./target";
import {
  isTranslateEngine,
  MAX_TRANSLATE_CHARS,
  type TranslateEngine,
  type TranslateResult,
} from "./types";

export type { TranslateEngine, TranslateResult } from "./types";
export { isTranslateEngine, TRANSLATE_ENGINES } from "./types";

function pref(key: string): string {
  return String(Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true) ?? "");
}

export function readTranslateEngine(): TranslateEngine {
  const raw = pref("translateEngine");
  return isTranslateEngine(raw) ? raw : "google";
}

export async function translateSelection(
  text: string,
  signal?: AbortSignal,
): Promise<TranslateResult> {
  const clipped = clipText(text, MAX_TRANSLATE_CHARS);
  if (!clipped) return { ok: false, code: "empty" };
  const engine = readTranslateEngine();
  const target = targetForEngine(engine, readUiLanguage());
  const req = { text: clipped, target, signal };
  switch (engine) {
    case "deepl":
      return translateDeepl(req, pref("translateDeeplKey"));
    case "google-cloud":
      return translateGoogleCloud(req, pref("translateGoogleCloudKey"));
    case "azure":
      return translateAzure(
        req,
        pref("translateAzureKey"),
        pref("translateAzureRegion") || "global",
      );
    case "chat-model":
      return translateChatModel(req);
    default:
      return translateGoogle(req);
  }
}
