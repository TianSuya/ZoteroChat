import { describe, expect, it } from "vitest";

import {
  parseAzure,
  parseChatCompletion,
  parseDeepl,
  parseGoogleCloud,
  parseGoogleGtx,
} from "./parse";
import { clipText, targetForEngine } from "./target";

describe("translate parsers", () => {
  it("joins Google gtx sentence chunks", () => {
    const data = [
      [
        ["你好", "Hello", null, null, 10],
        ["世界", " world", null, null, 10],
      ],
      null,
      "en",
    ];
    expect(parseGoogleGtx(data)).toBe("你好世界");
  });

  it("reads DeepL translations[].text", () => {
    expect(
      parseDeepl({
        translations: [{ text: "Hallo", detected_source_language: "EN" }],
      }),
    ).toBe("Hallo");
  });

  it("reads Google Cloud data.translations[].translatedText", () => {
    expect(
      parseGoogleCloud({
        data: { translations: [{ translatedText: "Bonjour" }] },
      }),
    ).toBe("Bonjour");
  });

  it("reads Azure [0].translations[0].text", () => {
    expect(
      parseAzure([{ translations: [{ text: "こんにちは", to: "ja" }] }]),
    ).toBe("こんにちは");
  });

  it("reads Chat Completions message.content", () => {
    expect(
      parseChatCompletion({
        choices: [{ message: { role: "assistant", content: "  译  " } }],
      }),
    ).toBe("译");
  });
});

describe("targetForEngine", () => {
  it("maps Chinese variants per vendor", () => {
    expect(targetForEngine("google", "zh-CN")).toBe("zh-CN");
    expect(targetForEngine("deepl", "zh-CN")).toBe("ZH-HANS");
    expect(targetForEngine("deepl", "zh-TW")).toBe("ZH-HANT");
    expect(targetForEngine("azure", "zh-TW")).toBe("zh-Hant");
  });

  it("clips long selections", () => {
    expect(clipText("abc", 10)).toBe("abc");
    expect(clipText("abcdefghij", 4)).toBe("abcd…");
  });
});
