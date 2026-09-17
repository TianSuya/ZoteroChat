import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { report } from "../utils/report";

/** Mirrors the shape we will actually persist: append-only, one row per turn. */
type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const convertMessage = (m: StoredMessage): ThreadMessageLike => ({
  id: m.id,
  role: m.role,
  content: [{ type: "text", text: m.content }],
});

/**
 * M2 gate: assistant-ui's external-store runtime, driven the way we intend to
 * drive it.
 *
 * Checks the things that would actually sink the plan rather than that the
 * package imports:
 *
 *  - the runtime renders through `useExternalStoreRuntime`, with our store as
 *    the source of truth;
 *  - streaming works by rewriting the in-flight assistant message (there is no
 *    delta API), which is how our token stream will drive it;
 *  - capability gating really does hide edit and branch UI when `onEdit` and
 *    `setMessages` are withheld — that is the append-only invariant expressed
 *    in the UI, and we get it for free only if it is true.
 */
export function AssistantProbe({ onDone }: { onDone?: () => void }) {
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const onNew = useCallback(async (message: AppendMessage) => {
    const part = message.content[0];
    const text = part?.type === "text" ? part.text : "";

    const userID = `u${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userID, role: "user", content: text },
    ]);

    // Stream by rewriting the assistant row, chunk by chunk.
    setIsRunning(true);
    const assistantID = `a${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantID, role: "assistant", content: "" },
    ]);

    for (const chunk of [
      "Streaming ",
      "one ",
      "chunk ",
      "at ",
      "a ",
      "time.",
    ]) {
      await new Promise((r) => setTimeout(r, 60));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantID ? { ...m, content: m.content + chunk } : m,
        ),
      );
    }
    setIsRunning(false);
  }, []);

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    convertMessage,
    onNew,
    // Deliberately no onEdit / setMessages: append-only.
  });

  const adapterKeys = useMemo(
    () => ["messages", "isRunning", "convertMessage", "onNew"],
    [],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 300));
        await runtime.thread.append("Does the runtime work in here?");
        // 6 chunks x 60ms, plus room for React to commit the last one.
        await new Promise((r) => setTimeout(r, 1800));

        const root = rootRef.current;
        const text = root?.textContent ?? "";
        report(
          "ASSISTANT PROBE",
          JSON.stringify(
            {
              adapterKeys,
              messageRows:
                root?.querySelectorAll("[data-zc-message]").length ?? 0,
              userRendered: text.includes("Does the runtime work in here?"),
              streamedFully: text.includes("Streaming one chunk at a time."),
              composerRendered: Boolean(root?.querySelector("textarea")),
              // Append-only is meant to express itself as missing
              // capabilities. Ask the runtime rather than guessing at DOM
              // attributes: a selector matching nothing would "pass" for
              // entirely the wrong reason.
              capabilities:
                (runtime.thread as any)?.getState?.()?.capabilities ?? null,
            },
            null,
            1,
          ),
        );
        onDone?.();
      } catch (err) {
        report(
          "ASSISTANT PROBE failed",
          String(err),
          String((err as Error)?.stack ?? "").slice(0, 400),
        );
      }
    })();
  }, [runtime, adapterKeys, onDone]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div ref={rootRef} className="flex h-full min-h-0 flex-col">
        <ThreadPrimitive.Viewport className="zc-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <ThreadPrimitive.Messages
            components={{
              UserMessage: () => (
                <MessagePrimitive.Root
                  data-zc-message="user"
                  className="mb-3 border-l-2 border-accent bg-surface-subtle py-1 pl-2 text-base"
                >
                  <MessagePrimitive.Parts />
                </MessagePrimitive.Root>
              ),
              AssistantMessage: () => (
                <MessagePrimitive.Root
                  data-zc-message="assistant"
                  className="mb-3 text-base"
                >
                  <MessagePrimitive.Parts />
                </MessagePrimitive.Root>
              ),
            }}
          />
        </ThreadPrimitive.Viewport>

        <ComposerPrimitive.Root className="shrink-0 px-3 pb-2">
          <ComposerPrimitive.Input
            rows={1}
            placeholder="Ask anything…"
            className="w-full resize-none rounded-md bg-surface-subtle px-2 py-1.5 text-base text-fg outline-none placeholder:text-fg-faint"
          />
        </ComposerPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
}
