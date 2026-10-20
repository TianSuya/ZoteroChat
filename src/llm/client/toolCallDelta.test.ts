import { describe, expect, it } from "vitest";

import { ToolCallCollector } from "./toolCallDelta";

describe("ToolCallCollector", () => {
  it("assembles one streamed call from partial arguments", () => {
    const collector = new ToolCallCollector();
    collector.add({
      index: 0,
      id: "call_1",
      type: "function",
      function: { name: "search_web", arguments: '{"query":"att' },
    });
    collector.add({ index: 0, function: { arguments: 'ention"}' } });

    expect(collector.finish()).toEqual([
      {
        id: "call_1",
        type: "function",
        function: { name: "search_web", arguments: '{"query":"attention"}' },
      },
    ]);
  });

  it("keeps parallel calls by index even when names repeat", () => {
    const collector = new ToolCallCollector();
    collector.add({
      index: 1,
      id: "call_b",
      function: { name: "fetch_url", arguments: '{"url":"https://b"' },
    });
    collector.add({
      index: 0,
      id: "call_a",
      function: { name: "search_web", arguments: '{"query":"a"}' },
    });
    collector.add({
      index: 1,
      function: { name: "fetch_url", arguments: "}" },
    });

    const calls = collector.finish();
    expect(calls.map((c) => c.id)).toEqual(["call_a", "call_b"]);
    expect(calls[1]?.function.arguments).toBe('{"url":"https://b"}');
  });

  it("ignores calls without a function name and fills missing ids", () => {
    const collector = new ToolCallCollector();
    collector.add({ index: 0, function: { arguments: "{}" } });
    collector.add({
      index: 1,
      function: { name: "ask_user", arguments: '{"question":"why?"}' },
    });
    const calls = collector.finish();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.id).toBe("call_1");
  });
});
