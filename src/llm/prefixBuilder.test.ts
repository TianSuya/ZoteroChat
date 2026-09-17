import { describe, expect, it } from "vitest";

import { buildRequestMessages, frozenPrefix } from "./prefixBuilder";
import { PrefixLedger, hashMessages } from "./prefixLedger";
import { ACK_TEXT, SYSTEM_PROMPT } from "./prompts";
import { stableStringify } from "./stableStringify";

describe("frozenPrefix", () => {
  it("is byte-identical across calls", () => {
    const a = frozenPrefix("title: X", "hello");
    const b = frozenPrefix("title: X", "hello");
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(a[0]?.content).toBe(SYSTEM_PROMPT);
    expect(a[2]?.content).toBe(ACK_TEXT);
  });
});

describe("PrefixLedger", () => {
  it("accepts the first turn and every append-only follow-up", () => {
    const prefix = frozenPrefix("title: X", "hello");
    const ledger = new PrefixLedger();

    const turn1 = buildRequestMessages({
      prefix,
      turns: [],
      question: "What is this?",
      language: "en",
    });
    expect(ledger.check(turn1).ok).toBe(true);
    const reply1 = { role: "assistant" as const, content: "A paper." };
    ledger.commit([...turn1, reply1]);

    const turn2 = buildRequestMessages({
      prefix,
      turns: [turn1[turn1.length - 1]!, reply1],
      question: "And the method?",
      language: "en",
    });
    expect(ledger.check(turn2).ok).toBe(true);
    expect(hashMessages(turn2.slice(0, -1))).toBe(
      hashMessages([...turn1, reply1]),
    );
  });

  it("flags a rewritten prefix", () => {
    const ledger = new PrefixLedger();
    const prefix = frozenPrefix("title: X", "hello");
    const turn1 = buildRequestMessages({
      prefix,
      turns: [],
      question: "What is this?",
      language: "en",
    });
    ledger.check(turn1);
    ledger.commit([...turn1, { role: "assistant", content: "A paper." }]);

    const broken = buildRequestMessages({
      prefix: frozenPrefix("title: Y", "hello"),
      turns: [],
      question: "What is this?",
      language: "en",
    });
    expect(ledger.check(broken).ok).toBe(false);
  });

  it("does not break the prefix when only the reply language changes", () => {
    const prefix = frozenPrefix("title: X", "hello");
    const ledger = new PrefixLedger();
    const turn1 = buildRequestMessages({
      prefix,
      turns: [],
      question: "What is this?",
      language: "en",
    });
    ledger.commit([...turn1, { role: "assistant", content: "A paper." }]);
    const turn2 = buildRequestMessages({
      prefix,
      turns: [
        turn1[turn1.length - 1]!,
        { role: "assistant", content: "A paper." },
      ],
      question: "And the method?",
      language: "zh-CN",
    });
    expect(ledger.check(turn2).ok).toBe(true);
  });
});
