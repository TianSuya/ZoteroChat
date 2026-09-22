import { config } from "../../../package.json";
import { chatCompletionsUrl } from "../../llm/client/chatCompletions";
import { loadApiKey } from "../../llm/secrets";
import { aborted, asResult, httpError, mainFetch, readJson } from "../http";
import { parseChatCompletion } from "../parse";
import type { TranslateRequest, TranslateResult } from "../types";

export async function translateChatModel(
  req: TranslateRequest,
): Promise<TranslateResult> {
  let key: string;
  try {
    key = await loadApiKey();
  } catch {
    return { ok: false, code: "missing-key" };
  }
  const baseUrl =
    (Zotero.Prefs.get(`${config.prefsPrefix}.apiBaseUrl`, true) as string) ||
    "https://api.deepseek.com";
  const model =
    (Zotero.Prefs.get(`${config.prefsPrefix}.model`, true) as string) ||
    "deepseek-flash";
  try {
    const res = await mainFetch()(chatCompletionsUrl(baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `Translate the user's text into ${req.target}. Output only the translation, with no quotes or commentary.`,
          },
          { role: "user", content: req.text },
        ],
        thinking: { type: "disabled" },
        max_tokens: 2048,
      }),
      signal: req.signal,
    });
    const { status, data, snippet } = await readJson(res);
    if (!res.ok) return httpError(status, snippet);
    return asResult(parseChatCompletion(data));
  } catch (err) {
    if (aborted(err)) return { ok: false, code: "aborted" };
    return {
      ok: false,
      code: "network",
      detail: String((err as Error)?.message ?? err),
    };
  }
}
