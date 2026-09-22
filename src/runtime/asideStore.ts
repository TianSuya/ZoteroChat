import {
  generateId,
  useExternalStoreRuntime,
  type AppendMessage,
} from "@assistant-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { BridgeUsage, PanelBridge } from "../panel-app/bridge";
import { convertMessage, type StoredMessage } from "./externalStore";
import { report } from "../utils/report";

function textOf(message: AppendMessage): string {
  const part = message.content.find((p) => p.type === "text");
  return part && part.type === "text" ? part.text : "";
}

export type AsideView = {
  usage: BridgeUsage | null;
  prefixBreak: boolean;
};

export function useAsideRuntime(
  bridge: PanelBridge,
  asideId: string,
  messages: StoredMessage[],
  setMessages: (
    next: StoredMessage[] | ((prev: StoredMessage[]) => StoredMessage[]),
  ) => void,
): {
  runtime: ReturnType<typeof useExternalStoreRuntime>;
  view: AsideView;
} {
  const [isRunning, setIsRunning] = useState(false);
  const [usage, setUsage] = useState<BridgeUsage | null>(null);
  const [prefixBreak, setPrefixBreak] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const question = textOf(message);
      const userID = generateId();
      setMessages((prev) => [
        ...prev,
        { id: userID, role: "user", content: question },
      ]);

      setIsRunning(true);
      setPrefixBreak(false);
      const assistantID = generateId();
      setMessages((prev) => [
        ...prev,
        { id: assistantID, role: "assistant", content: "" },
      ]);

      const job = bridge.streamAsideTurn(
        { asideId, question },
        {
          onDelta: (piece) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantID ? { ...m, content: m.content + piece } : m,
              ),
            );
          },
          onUsage: (next) => setUsage(next),
          onPrefixBreak: () => setPrefixBreak(true),
        },
      );
      cancelRef.current = job.cancel;

      try {
        await job.done;
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (name === "AbortError") return;
        const text = `Error: ${String((err as Error)?.message ?? err)}`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantID
              ? { ...m, content: m.content ? `${m.content}\n\n${text}` : text }
              : m,
          ),
        );
        report("aside stream failed", String(err));
      } finally {
        cancelRef.current = null;
        setIsRunning(false);
      }
    },
    [asideId, bridge, setMessages],
  );

  const onCancel = useCallback(async () => {
    cancelRef.current?.();
    setIsRunning(false);
  }, []);

  useEffect(() => () => cancelRef.current?.(), []);

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    convertMessage,
    onNew,
    onCancel,
  });

  return { runtime, view: { usage, prefixBreak } };
}
