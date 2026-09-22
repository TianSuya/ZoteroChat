import type { ReplyLanguage } from "./languages";

/**
 * Lives only in the current-turn suffix. Changing language must not touch
 * the frozen [0][1][2] paper prefix.
 *
 * The previous wording ("keep quotations in their original wording") caused
 * English clauses to be spliced into Chinese answers. Target-language replies
 * must paraphrase; only names, symbols, and formulas may stay original.
 */
function lockLanguage(englishName: string, nativeName: string): string {
  return [
    `OUTPUT LANGUAGE: ${englishName} (${nativeName}).`,
    `Write the entire answer in ${englishName}. Do not switch languages mid-sentence or mid-paragraph.`,
    `Do not paste sentences or clauses from the paper's original language into the answer.`,
    `When you need to refer to a passage, paraphrase it in ${englishName}.`,
    `You may keep only proper nouns, model names, variable names, and formulas in their original form (for example Transformer, LayerNorm, d_model, Attention(Q, K, V)).`,
    `After any formula, explain it in ${englishName}.`,
    `Do not invent page numbers.`,
  ].join(" ");
}

/** Suffix-only. Tells the model this turn is a brief aside, not a new paper. */
export function asideTurnDirective(): string {
  return [
    "This is a brief aside about the quoted passage from the main conversation.",
    "Answer that local question directly.",
    "Do not recap the whole paper.",
  ].join(" ");
}

export function turnDirectivesFor(language: ReplyLanguage): string {
  switch (language) {
    case "zh-CN":
      return lockLanguage("Simplified Chinese", "简体中文");
    case "zh-TW":
      return lockLanguage("Traditional Chinese", "繁體中文");
    case "en":
      return [
        "OUTPUT LANGUAGE: English.",
        "Write the entire answer in English.",
        "If the paper is in English, short quotations are allowed; if it is not, paraphrase into English.",
        "Proper nouns, model names, variable names, and formulas may stay in original form.",
        "Do not invent page numbers.",
      ].join(" ");
    case "ja":
      return lockLanguage("Japanese", "日本語");
    case "ko":
      return lockLanguage("Korean", "한국어");
    case "de":
      return lockLanguage("German", "Deutsch");
    case "fr":
      return lockLanguage("French", "français");
    case "auto":
      return [
        "Write the entire answer in one language: the language of <question>.",
        "Do not splice sentences from the paper's language into that answer.",
        "When you refer to a passage, paraphrase it in the answer language.",
        "Proper nouns, model names, variable names, and formulas may stay in original form.",
        "Do not invent page numbers.",
      ].join(" ");
  }
}
