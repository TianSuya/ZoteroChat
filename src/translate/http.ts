import type { TranslateResult } from "./types";

export function mainFetch(): typeof fetch {
  const win = Zotero.getMainWindow() as Window | null;
  if (!win?.fetch) throw new Error("No Zotero window.");
  return win.fetch.bind(win);
}

export async function readJson(
  res: Response,
): Promise<{ status: number; data: unknown; snippet: string }> {
  const raw = await res.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  return { status: res.status, data, snippet: raw.slice(0, 180) };
}

export function httpError(status: number, snippet: string): TranslateResult {
  return { ok: false, code: "http", detail: `${status}${snippet ? `: ${snippet}` : ""}` };
}

export function asResult(text: string): TranslateResult {
  return text ? { ok: true, text } : { ok: false, code: "parse" };
}

export function aborted(err: unknown): boolean {
  return (err as { name?: string })?.name === "AbortError";
}
