import { config } from "../../package.json";
import { loadApiKey } from "../llm/secrets";

export type SearchSettings = {
  /** Search and Fetch tools are exposed to the model. */
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  /** The add-paper tool may run, after an explicit user confirmation. */
  allowPaperDownloads: boolean;
};

function boolPref(key: string, fallback: boolean): boolean {
  const value = Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
  return typeof value === "boolean" ? value : fallback;
}

export function readSearchEnabled(): boolean {
  return boolPref("searchEnabled", true);
}

export function readAllowPaperDownloads(): boolean {
  return boolPref("allowPaperDownloads", true);
}

export function readSearchBaseUrl(): string {
  const value = String(
    Zotero.Prefs.get(`${config.prefsPrefix}.searchBaseUrl`, true) ?? "",
  ).trim();
  return value || "https://api.deepseek.com";
}

/** A dedicated search key wins; otherwise Search/Fetch reuse the chat key. */
export async function loadSearchApiKey(): Promise<string> {
  const fromPrefs = String(
    Zotero.Prefs.get(`${config.prefsPrefix}.searchApiKey`, true) ?? "",
  ).trim();
  if (fromPrefs) return fromPrefs;
  return loadApiKey();
}

export async function readSearchSettings(): Promise<SearchSettings> {
  let apiKey: string;
  try {
    apiKey = await loadSearchApiKey();
  } catch {
    apiKey = "";
  }
  return {
    enabled: readSearchEnabled() && Boolean(apiKey),
    baseUrl: readSearchBaseUrl(),
    apiKey,
    allowPaperDownloads: readAllowPaperDownloads(),
  };
}

export function readSearchApiKeySync(): string {
  return String(
    Zotero.Prefs.get(`${config.prefsPrefix}.searchApiKey`, true) ?? "",
  ).trim();
}
