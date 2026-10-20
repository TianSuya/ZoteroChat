import { describe, expect, it } from "vitest";

import { readSseData } from "./sse";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const data of readSseData(stream)) out.push(data);
  return out;
}

describe("readSseData", () => {
  it("reads data lines split across chunks", async () => {
    expect(
      await collect(streamOf('data: {"a":1}\n', 'data: {"b":2}\n')),
    ).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("flushes a final line without a trailing newline", async () => {
    expect(await collect(streamOf('data: {"a":1}'))).toEqual(['{"a":1}']);
  });

  it("stops at [DONE]", async () => {
    expect(await collect(streamOf('data: {"a":1}\ndata: [DONE]\n'))).toEqual([
      '{"a":1}',
    ]);
  });
});
