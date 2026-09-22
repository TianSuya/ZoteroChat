import { aborted, asResult, httpError, mainFetch, readJson } from "../http";
import { parseAzure } from "../parse";
import type { TranslateRequest, TranslateResult } from "../types";

export async function translateAzure(
  req: TranslateRequest,
  apiKey: string,
  region: string,
): Promise<TranslateResult> {
  const key = apiKey.trim();
  if (!key) return { ok: false, code: "missing-key" };
  const url = new URL("https://api.cognitive.microsofttranslator.com/translate");
  url.searchParams.set("api-version", "3.0");
  url.searchParams.set("to", req.target);
  try {
    const res = await mainFetch()(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": key,
        "Ocp-Apim-Subscription-Region": region.trim() || "global",
      },
      body: JSON.stringify([{ Text: req.text }]),
      signal: req.signal,
    });
    const { status, data, snippet } = await readJson(res);
    if (!res.ok) return httpError(status, snippet);
    return asResult(parseAzure(data));
  } catch (err) {
    if (aborted(err)) return { ok: false, code: "aborted" };
    return { ok: false, code: "network", detail: String((err as Error)?.message ?? err) };
  }
}
