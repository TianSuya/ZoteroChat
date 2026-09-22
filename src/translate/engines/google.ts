import { aborted, asResult, httpError, mainFetch, readJson } from "../http";
import { parseGoogleGtx } from "../parse";
import type { TranslateRequest, TranslateResult } from "../types";

export async function translateGoogle(
  req: TranslateRequest,
): Promise<TranslateResult> {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", req.target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", req.text);
  try {
    const res = await mainFetch()(url.toString(), { signal: req.signal });
    const { status, data, snippet } = await readJson(res);
    if (!res.ok) return httpError(status, snippet);
    return asResult(parseGoogleGtx(data));
  } catch (err) {
    if (aborted(err)) return { ok: false, code: "aborted" };
    return { ok: false, code: "network", detail: String((err as Error)?.message ?? err) };
  }
}
