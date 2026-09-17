import { describe, expect, it } from "vitest";

import { turnDirectivesFor } from "./directives";
import { buildCurrentUserMessage } from "../llm/prefixBuilder";

describe("turnDirectivesFor", () => {
  it("forbids splicing original-language sentences into zh-CN answers", () => {
    const d = turnDirectivesFor("zh-CN");
    expect(d).toMatch(/Simplified Chinese/);
    expect(d).toMatch(/Do not paste sentences/);
    expect(d).not.toMatch(/original wording/);
  });

  it("places the language lock before the question", () => {
    const msg = buildCurrentUserMessage("方法是什么？", null, "zh-CN");
    const dir = msg.indexOf("<turn-directives>");
    const q = msg.indexOf("<question>");
    expect(dir).toBeGreaterThanOrEqual(0);
    expect(q).toBeGreaterThan(dir);
  });
});
