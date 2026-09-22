import { aborted, asResult, httpError, mainFetch, readJson } from "../http";
import { parseGoogleCloud } from "../parse";
import type { TranslateRequest, TranslateResult } from "../types";

export async function translateGoogleCloud(
  req: TranslateRequest,
  apiKey: string,
): Promise<TranslateResult> {
  const key = apiKey.trim();
  if (!key) return { ok: false, code: "missing-key" };
  const url = new URL(
    "https://translation.googleapis.com/language/translate/v2",
  );
  url.searchParams.set("key", key);
  try {
    const res = await mainFetch()(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: req.text,
        target: req.target,
        format: "text",
      }),
      signal: req.signal,
    });
    const { status, data, snippet } = await readJson(res);
    if (!res.ok) return httpError(status, snippet);
    return asResult(parseGoogleCloud(data));
  } catch (err) {
    if (aborted(err)) return { ok: false, code: "aborted" };
    return {
      ok: false,
      code: "network",
      detail: String((err as Error)?.message ?? err),
    };
  }
}
