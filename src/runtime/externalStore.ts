import {
  generateId,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  BridgeAside,
  BridgeNoteContext,
  BridgeMode,
  BridgeNote,
  BridgePaperBatchDecision,
  BridgePaperBatchRequest,
  BridgePaperRequest,
  BridgePaperStatus,
  BridgePendingPrompt,
  BridgeSelection,
  BridgeStreamJob,
  BridgeUsage,
  PanelBridge,
} from "../panel-app/bridge";
import type { ToolTrace } from "../llm/types";
import { encodeUserContent } from "../ui/thread/userContent";
import { report } from "../utils/report";

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolTrace?: ToolTrace[];
};

export const convertMessage = (m: StoredMessage): ThreadMessageLike => ({
  id: m.id,
  role: m.role,
  content: [{ type: "text", text: m.content }],
  metadata: m.toolTrace?.length
    ? { custom: { toolTrace: m.toolTrace } }
    : undefined,
});

function textOf(message: AppendMessage): string {
  const part = message.content.find((p) => p.type === "text");
  return part && part.type === "text" ? part.text : "";
}

function abortError(): Error {
  const err = new Error("Aborted");
  err.name = "AbortError";
  return err;
}

type PendingResolver = {
  kind: "question" | "paper" | "papers";
  resolve: (value: string | boolean | BridgePaperBatchDecision) => void;
  reject: (err: Error) => void;
};

export type RuntimeView = {
  mode: BridgeMode;
  note: BridgeNoteContext | null;
  paper: BridgePaperStatus | null;
  paperError: string | null;
  paperLoading: boolean;
  usage: BridgeUsage | null;
  prefixBreak: boolean;
  restoredAsides: BridgeAside[];
  notes: BridgeNote[];
  pendingPrompt: BridgePendingPrompt | null;
  answerPrompt: (value: string | boolean | BridgePaperBatchDecision) => void;
  skipPrompt: () => void;
};

/**
 * Display-only history in the panel; the plugin owns the wire-format
 * transcript, the frozen paper prefix, and the tool loop.
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
  const [mode, setMode] = useState<BridgeMode>(bridge.mode);
  const [note, setNote] = useState<BridgeNoteContext | null>(
    bridge.note ?? null,
  );
  const [paper, setPaper] = useState<BridgePaperStatus | null>(null);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [paperLoading, setPaperLoading] = useState(true);
  const [usage, setUsage] = useState<BridgeUsage | null>(null);
  const [prefixBreak, setPrefixBreak] = useState(false);
  const [restoredAsides, setRestoredAsides] = useState<BridgeAside[]>([]);
  const [notes, setNotes] = useState<BridgeNote[]>([]);
  const [pendingPrompt, setPendingPrompt] =
    useState<BridgePendingPrompt | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const promptRef = useRef<PendingResolver | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPaperLoading(true);
    setPaperError(null);
    bridge
      .beginConversation()
      .then((status) => {
        if (cancelled) return;
        setMode(status.mode);
        setNote(status.note);
        setPaper(status.mode === "paper" ? status : null);
        setMessages(status.messages);
        setRestoredAsides(status.asides);
        setNotes(status.notes);
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

  const settleAsk = useCallback(
    (value: string | boolean | BridgePaperBatchDecision | null) => {
      const pending = promptRef.current;
      if (!pending) return;
      promptRef.current = null;
      setPendingPrompt(null);
      if (value === null) pending.reject(abortError());
      else pending.resolve(value);
    },
    [],
  );

  const askUser = useCallback(
    (req: { question: string; options?: string[] }) =>
      new Promise<string>((resolve, reject) => {
        promptRef.current = {
          kind: "question",
          resolve: (value) => resolve(typeof value === "string" ? value : ""),
          reject,
        };
        setPendingPrompt({ kind: "question", ...req });
      }),
    [],
  );

  const confirmPaper = useCallback(
    (req: BridgePaperRequest) =>
      new Promise<boolean>((resolve, reject) => {
        promptRef.current = {
          kind: "paper",
          resolve: (value) => resolve(value === true),
          reject,
        };
        setPendingPrompt({ kind: "paper", ...req });
      }),
    [],
  );

  const presentPapers = useCallback(
    (req: BridgePaperBatchRequest) =>
      new Promise<BridgePaperBatchDecision>((resolve, reject) => {
        promptRef.current = {
          kind: "papers",
          resolve: (value) => {
            if (value && typeof value === "object" && "action" in value) {
              resolve(value);
            } else {
              resolve({ action: "cancel" });
            }
          },
          reject,
        };
        setPendingPrompt({ kind: "papers", ...req });
      }),
    [],
  );

  const answerPrompt = useCallback(
    (value: string | boolean | BridgePaperBatchDecision) => settleAsk(value),
    [settleAsk],
  );

  const skipPrompt = useCallback(() => {
    const pending = promptRef.current;
    settleAsk(
      pending?.kind === "paper"
        ? false
        : pending?.kind === "papers"
          ? { action: "cancel" }
          : "The user skipped the question.",
    );
  }, [settleAsk]);

  useEffect(
    () => () => {
      cancelRef.current?.();
      promptRef.current?.reject(abortError());
      promptRef.current = null;
    },
    [],
  );

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

      let job: BridgeStreamJob;
      try {
        job = bridge.streamTurn(
          { question, selection, userId: userID, assistantId: assistantID },
          {
            onDelta: (piece) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantID
                    ? { ...m, content: m.content + piece }
                    : m,
                ),
              );
            },
            onUsage: (next) => setUsage(next),
            onPrefixBreak: () => setPrefixBreak(true),
            onToolTrace: (trace) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantID ? { ...m, toolTrace: trace } : m,
                ),
              );
            },
            onAskUser: askUser,
            onConfirmPaper: confirmPaper,
            onPresentPapers: presentPapers,
          },
        );
        cancelRef.current = job.cancel;
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
        if (promptRef.current) settleAsk(null);
        setIsRunning(false);
      }
    },
    [askUser, bridge, confirmPaper, getSelection, presentPapers, settleAsk],
  );

  const onCancel = useCallback(async () => {
    cancelRef.current?.();
    settleAsk(null);
    setIsRunning(false);
  }, [settleAsk]);

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    convertMessage,
    onNew,
    onCancel,
  });

  return {
    runtime,
    view: {
      mode,
      note,
      paper,
      paperError,
      paperLoading,
      usage,
      prefixBreak,
      restoredAsides,
      notes,
      pendingPrompt,
      answerPrompt,
      skipPrompt,
    },
  };
}
