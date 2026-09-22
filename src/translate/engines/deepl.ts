import { aborted, asResult, httpError, mainFetch, readJson } from "../http";
import { parseDeepl } from "../parse";
import type { TranslateRequest, TranslateResult } from "../types";

export async function translateDeepl(
  req: TranslateRequest,
  apiKey: string,
): Promise<TranslateResult> {
  const key = apiKey.trim();
  if (!key) return { ok: false, code: "missing-key" };
  const host = key.endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";
  const body = new URLSearchParams({
    text: req.text,
    target_lang: req.target,
  });
  try {
    const res = await mainFetch()(`${host}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: req.signal,
    });
    const { status, data, snippet } = await readJson(res);
    if (!res.ok) return httpError(status, snippet);
    return asResult(parseDeepl(data));
  } catch (err) {
    if (aborted(err)) return { ok: false, code: "aborted" };
    return { ok: false, code: "network", detail: String((err as Error)?.message ?? err) };
  }
}
