import {
  generateId,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  BridgePaperStatus,
  BridgeSelection,
  BridgeUsage,
  PanelBridge,
} from "../panel-app/bridge";
import { encodeUserContent } from "../ui/thread/userContent";
import { report } from "../utils/report";

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export const convertMessage = (m: StoredMessage): ThreadMessageLike => ({
  id: m.id,
  role: m.role,
  content: [{ type: "text", text: m.content }],
});

function textOf(message: AppendMessage): string {
  const part = message.content.find((p) => p.type === "text");
  return part && part.type === "text" ? part.text : "";
}

export type RuntimeView = {
  paper: BridgePaperStatus | null;
  paperError: string | null;
  paperLoading: boolean;
  usage: BridgeUsage | null;
  prefixBreak: boolean;
};

/**
 * Display-only history in the panel; the plugin owns the wire-format
 * transcript and the frozen paper prefix.
 */
export function useThreadRuntime(
  bridge: PanelBridge,
  getSelection: () => BridgeSelection | null,
): {
  runtime: ReturnType<typeof useExternalStoreRuntime>;
  view: RuntimeView;
} {
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [paper, setPaper] = useState<BridgePaperStatus | null>(null);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [paperLoading, setPaperLoading] = useState(true);
  const [usage, setUsage] = useState<BridgeUsage | null>(null);
  const [prefixBreak, setPrefixBreak] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPaperLoading(true);
    setPaperError(null);
    bridge
      .beginConversation()
      .then((status) => {
        if (cancelled) return;
        setPaper(status);
        setPaperLoading(false);
        report("paper ready", status.charCount, status.hash);
      })
      .catch((err) => {
        if (cancelled) return;
        setPaperLoading(false);
        setPaperError(String((err as Error)?.message ?? err));
        report("paper extract failed", String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const question = textOf(message);
      const selection = getSelection();
      const userID = generateId();
      setMessages((prev) => [
        ...prev,
        {
          id: userID,
          role: "user",
          content: encodeUserContent(question, selection),
        },
      ]);

      setIsRunning(true);
      setPrefixBreak(false);
      const assistantID = generateId();
      setMessages((prev) => [
        ...prev,
        { id: assistantID, role: "assistant", content: "" },
      ]);

      const job = bridge.streamTurn(
        { question, selection },
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
        report("stream failed", String(err));
      } finally {
        cancelRef.current = null;
        setIsRunning(false);
      }
    },
    [bridge, getSelection],
  );

  const onCancel = useCallback(async () => {
    cancelRef.current?.();
    setIsRunning(false);
  }, []);

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    convertMessage,
    onNew,
    onCancel,
  });

  return {
    runtime,
    view: { paper, paperError, paperLoading, usage, prefixBreak },
  };
}
