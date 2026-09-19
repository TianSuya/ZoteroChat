/**
 * Loaded into the preferences window via PreferencePanes `scripts`.
 *
 * The script runs when the pane is registered into the window, which can be
 * *before* the XHTML fragment is inserted. Init therefore waits for the
 * fragment (vbox onload + a ready check). The test button also has an
 * `onclick` so a click still works if init lost the race.
 * Apply flushes fields and asks open chat panels to re-read prefs.
 */
import { config } from "../../package.json";

const PREFIX = config.prefsPrefix;
const L10N = `${config.addonRef}-prefs`;

type AddonApi = {
  testConnection: () => Promise<{
    ok: boolean;
    message: string;
    model?: string;
  }>;
  clearSecretCache: () => void;
  applyToPanels: () => void;
};

function api(): AddonApi | undefined {
  const instance = (
    Zotero as unknown as Record<string, { data?: { api?: AddonApi } }>
  )[config.addonInstance];
  return instance?.data?.api;
}

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function pref(key: string): string {
  return String(Zotero.Prefs.get(`${PREFIX}.${key}`, true) ?? "");
}

function setPref(key: string, value: string) {
  Zotero.Prefs.set(`${PREFIX}.${key}`, value, true);
  api()?.clearSecretCache();
}

function setStatus(
  kind: "idle" | "checking" | "ok" | "error",
  l10nId: string,
  args?: Record<string, string>,
) {
  const status = el<HTMLElement>("zc-status");
  if (!status) return;
  status.dataset.kind = kind === "ok" || kind === "error" ? kind : "";
  const doc = document as Document & {
    l10n?: {
      setAttributes: (
        node: Element,
        id: string,
        args?: Record<string, string>,
      ) => void;
    };
  };
  doc.l10n?.setAttributes(status, `${L10N}-${l10nId}`, args);
}

function flushFields() {
  const base = el<HTMLInputElement>("zc-api-base-url");
  const key = el<HTMLInputElement>("zc-api-key");
  const model = el<HTMLInputElement>("zc-model");
  const language = el<HTMLSelectElement>("zc-reply-language");
  if (base) setPref("apiBaseUrl", base.value.trim());
  if (key) setPref("apiKey", key.value.trim());
  if (model) setPref("model", model.value.trim());
  if (language) setPref("replyLanguage", language.value);
  const fontSize = el<HTMLSelectElement>("zc-font-size");
  if (fontSize) {
    Zotero.Prefs.set(`${PREFIX}.fontSize`, Number(fontSize.value), true);
  }
}

function apply() {
  flushFields();
  api()?.clearSecretCache();
  api()?.applyToPanels();
  setStatus("ok", "status-applied");
}

async function test() {
  flushFields();
  const button = el<HTMLButtonElement>("zc-test");
  if (button) button.disabled = true;
  setStatus("checking", "status-checking");
  try {
    const result = await api()?.testConnection();
    if (!result) {
      setStatus("error", "status-fail", { detail: "plugin not ready" });
      return;
    }
    if (result.ok) {
      setStatus("ok", "status-ok", { model: result.model || result.message });
    } else {
      setStatus("error", "status-fail", { detail: result.message });
    }
  } catch (err) {
    setStatus("error", "status-fail", {
      detail: String((err as Error)?.message ?? err),
    });
  } finally {
    if (button) button.disabled = false;
  }
}

function init() {
  const pane = el("zoterochat-preferences");
  if (!pane || pane.dataset.zcBound === "1") return;
  pane.dataset.zcBound = "1";

  for (const [id, key] of [
    ["zc-api-base-url", "apiBaseUrl"],
    ["zc-api-key", "apiKey"],
    ["zc-model", "model"],
  ] as const) {
    const input = el<HTMLInputElement>(id);
    if (!input) continue;
    input.addEventListener("change", () => setPref(key, input.value.trim()));
    input.addEventListener("blur", () => setPref(key, input.value.trim()));
  }

  const language = el<HTMLSelectElement>("zc-reply-language");
  if (language) {
    const current = pref("replyLanguage") || "zh-CN";
    language.value = current;
    language.addEventListener("change", () =>
      setPref("replyLanguage", language.value),
    );
  }

  const fontSize = el<HTMLSelectElement>("zc-font-size");
  if (fontSize) {
    const n = Number(Zotero.Prefs.get(`${PREFIX}.fontSize`, true));
    fontSize.value = String(Number.isFinite(n) ? n : 14);
    fontSize.addEventListener("change", () => {
      Zotero.Prefs.set(`${PREFIX}.fontSize`, Number(fontSize.value), true);
    });
  }

  el<HTMLButtonElement>("zc-apply")?.addEventListener("click", () => {
    apply();
  });
  el<HTMLButtonElement>("zc-test")?.addEventListener("click", () => {
    void test();
  });
}

const ZoteroChat_Preferences = { init, test, apply };
const root = typeof window !== "undefined" ? window : globalThis;
(
  root as unknown as { ZoteroChat_Preferences: typeof ZoteroChat_Preferences }
).ZoteroChat_Preferences = ZoteroChat_Preferences;

try {
  init();
} catch (err) {
  Zotero.debug(`[ZoteroChat] prefs pane init: ${String(err)}`);
}
