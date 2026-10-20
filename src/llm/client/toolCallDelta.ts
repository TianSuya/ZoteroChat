import type { ToolCall } from "../types";

type RawFunctionDelta = {
  name?: unknown;
  arguments?: unknown;
};

type RawToolCallDelta = {
  index?: unknown;
  id?: unknown;
  type?: unknown;
  function?: RawFunctionDelta;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Assembles streamed `delta.tool_calls` into complete calls.
 *
 * The first chunk of a call carries `id`/`type`/`function.name`; later chunks
 * only append `function.arguments`. Some OpenAI-compatible servers repeat the
 * full name or send an empty id/name on later chunks, so the merge is
 * deliberately tolerant instead of blind-concatenating.
 */
export class ToolCallCollector {
  private readonly calls = new Map<number, ToolCall>();

  add(raw: unknown): void {
    if (!raw || typeof raw !== "object") return;
    const delta = raw as RawToolCallDelta;
    const index = typeof delta.index === "number" ? delta.index : 0;
    let call = this.calls.get(index);
    if (!call) {
      call = {
        id: "",
        type: "function",
        function: { name: "", arguments: "" },
      };
      this.calls.set(index, call);
    }

    const id = str(delta.id);
    if (id) call.id = id;

    const name = str(delta.function?.name);
    if (name) {
      const current = call.function.name;
      if (!current) call.function.name = name;
      else if (name === current || current.startsWith(name)) {
        // Repeated or shorter duplicate: keep the longer current name.
      } else if (name.startsWith(current)) {
        // The server repeated the full name, possibly with more characters.
        call.function.name = name;
      } else {
        call.function.name += name;
      }
    }

    call.function.arguments += str(delta.function?.arguments);
  }

  finish(): ToolCall[] {
    return [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, call]) => ({
        ...call,
        id: call.id || `call_${index}`,
      }))
      .filter((call) => call.function.name !== "");
  }
}
