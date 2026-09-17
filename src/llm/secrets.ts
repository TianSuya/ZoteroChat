import { config } from "../../package.json";

let memo: string | null = null;

export function clearSecretCache(): void {
  memo = null;
}

/**
 * Prefer the key from Settings. The gitignored dev file is only a fallback
 * so `npm start` still works before the prefs pane has been filled in.
 */
export async function loadApiKey(): Promise<string> {
  if (memo) return memo;

  const fromPrefs = String(
    Zotero.Prefs.get(`${config.prefsPrefix}.apiKey`, true) ?? "",
  ).trim();
  if (fromPrefs) {
    memo = fromPrefs;
    return memo;
  }

  const path = String(
    Zotero.Prefs.get(`${config.prefsPrefix}.devApiKeyFile`, true) ?? "",
  ).trim();
  if (path && (await IOUtils.exists(path))) {
    const fromFile = (await IOUtils.readUTF8(path)).trim();
    if (fromFile) {
      memo = fromFile;
      return memo;
    }
  }

  throw new Error(
    "No API key set. Open ZoteroChat settings and paste your key.",
  );
}

/** Development convenience: copy the gitignored file into the prefs field once. */
export async function seedApiKeyFromDevFile(): Promise<void> {
  if (__env__ !== "development") return;
  const existing = String(
    Zotero.Prefs.get(`${config.prefsPrefix}.apiKey`, true) ?? "",
  ).trim();
  if (existing) return;
  const path = String(
    Zotero.Prefs.get(`${config.prefsPrefix}.devApiKeyFile`, true) ?? "",
  ).trim();
  if (!path || !(await IOUtils.exists(path))) return;
  const key = (await IOUtils.readUTF8(path)).trim();
  if (!key) return;
  Zotero.Prefs.set(`${config.prefsPrefix}.apiKey`, key, true);
  memo = key;
  ztoolkit.log("seeded apiKey from dev file");
}
