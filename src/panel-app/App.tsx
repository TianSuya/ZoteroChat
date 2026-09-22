import {
  AssistantRuntimeProvider,
  generateId,
  useAui,
} from "@assistant-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AssistantProbe } from "../dev/assistantProbe";
import { RadixProbe } from "../dev/radixProbe";
import { explainSelectionPrompt } from "../i18n/commands";
import type { UiLanguage } from "../i18n/languages";
import { useThreadRuntime, type StoredMessage } from "../runtime/externalStore";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { UiLanguageProvider, useUiLanguage } from "../ui/ReplyLanguage";
import { Thread } from "../ui/Thread";
import {
  AsideActionsProvider,
  type AsideMarker,
} from "../ui/thread/asideContext";
import { AsideOverlay } from "../ui/thread/AsideOverlay";
import type { BridgeSelection, PanelBridge } from "./bridge";

export function App({ bridge }: { bridge: PanelBridge }) {
  const [theme, setTheme] = useState(bridge.theme);
  const [fontSize, setFontSize] = useState(() => bridge.getFontSize());
  const [session, setSession] = useState(0);

  useEffect(() => bridge.onThemeChange?.(setTheme), [bridge]);
  useEffect(() => bridge.onFontSizeChange?.(setFontSize), [bridge]);
  useEffect(
    () =>
      bridge.onPrefsApplied?.(() => {
        setFontSize(bridge.getFontSize());
      }),
    [bridge],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.zcTheme = theme.mode;
    for (const [name, value] of Object.entries(theme.tokens)) {
      root.style.setProperty(name, value);
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--zc-font-size", `${fontSize}px`);
    root.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  const onNewConversation = useCallback(() => {
    setSession((n) => n + 1);
  }, []);

  return (
    <ErrorBoundary label="panel">
      <ChatSession
        key={session}
        bridge={bridge}
        onNewConversation={onNewConversation}
      >
        {__env__ === "development" && bridge.showProbe ? <RadixProbe /> : null}
        {__env__ === "development" && bridge.showAssistantProbe ? (
          <AssistantProbe />
        ) : null}
      </ChatSession>
    </ErrorBoundary>
  );
}

type AsideRecord = {
  id: string;
  sourceMessageId: string;
  quote: string;
  fromSelection: boolean;
  messages: StoredMessage[];
};

function ChatSession({
  bridge,
  onNewConversation,
  children,
}: {
  bridge: PanelBridge;
  onNewConversation: () => void;
  children?: React.ReactNode;
}) {
  const [selection, setSelection] = useState<BridgeSelection | null>(() =>
    bridge.getSelection(),
  );
  const selectionRef = useRef(selection);
  const commitSelection = useCallback((next: BridgeSelection | null) => {
    selectionRef.current = next;
    setSelection(next);
  }, []);
  const getSelection = useCallback(() => selectionRef.current, []);

  const { runtime, view } = useThreadRuntime(bridge, getSelection);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(() =>
    bridge.getUiLanguage(),
  );
  const [asides, setAsides] = useState<AsideRecord[]>([]);
  const [activeAsideId, setActiveAsideId] = useState<string | null>(null);
  const activeAsideIdRef = useRef<string | null>(null);
  activeAsideIdRef.current = activeAsideId;
  const mainRootRef = useRef<HTMLDivElement>(null);

  const activeAside = asides.find((a) => a.id === activeAsideId) ?? null;

  useEffect(() => bridge.onUiLanguageChange?.(setUiLanguage), [bridge]);
  useEffect(
    () =>
      bridge.onPrefsApplied?.(() => {
        setUiLanguage(bridge.getUiLanguage());
      }),
    [bridge],
  );
  useEffect(
    () => bridge.onSelectionChange?.(commitSelection),
    [bridge, commitSelection],
  );

  useEffect(() => {
    const el = mainRootRef.current;
    if (!el) return;
    if (activeAsideId) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }, [activeAsideId]);

  const onAskAside = useCallback(
    (
      sourceMessageId: string,
      quote: string,
      origin: "selection" | "message",
    ) => {
      const id = generateId();
      bridge.beginAside({ id, quote });
      setAsides((prev) => [
        ...prev,
        {
          id,
          sourceMessageId,
          quote,
          fromSelection: origin === "selection",
          messages: [],
        },
      ]);
      setActiveAsideId(id);
    },
    [bridge],
  );

  const onOpenAside = useCallback((asideId: string) => {
    setActiveAsideId(asideId);
  }, []);

  const onCloseAside = useCallback(() => {
    setActiveAsideId(null);
  }, []);

  const asideActions = useMemo(
    () => ({
      onAsk: onAskAside,
      onOpen: onOpenAside,
      markersFor: (sourceMessageId: string): AsideMarker[] =>
        asides
          .filter((a) => a.sourceMessageId === sourceMessageId)
          .map((a) => ({
            id: a.id,
            quote: a.quote,
            fromSelection: a.fromSelection,
          })),
    }),
    [asides, onAskAside, onOpenAside],
  );

  const setActiveMessages = useCallback(
    (next: StoredMessage[] | ((prev: StoredMessage[]) => StoredMessage[])) => {
      setAsides((prev) =>
        prev.map((a) => {
          if (a.id !== activeAsideIdRef.current) return a;
          const messages = typeof next === "function" ? next(a.messages) : next;
          return { ...a, messages };
        }),
      );
    },
    [],
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <UiLanguageProvider language={uiLanguage}>
        <ExplainBinder
          bridge={bridge}
          onSelection={commitSelection}
          onLeaveAside={onCloseAside}
        />
        <div className="relative h-full min-h-0">
          <AsideActionsProvider value={asideActions}>
            <div ref={mainRootRef} className="h-full min-h-0">
              <Thread
                paperTitle={view.paper?.title || bridge.paperTitle}
                onNewConversation={onNewConversation}
                onOpenSettings={bridge.openPreferences}
                selection={selection}
                onClearSelection={() => {
                  commitSelection(null);
                  bridge.dismissSelection();
                }}
                usage={view.usage}
                charCount={view.paper?.charCount}
                prefixBreak={view.prefixBreak}
                paperError={view.paperError}
                paperLoading={view.paperLoading}
              >
                {children}
              </Thread>
            </div>
          </AsideActionsProvider>
          {activeAside ? (
            <AsideOverlay
              key={activeAside.id}
              bridge={bridge}
              asideId={activeAside.id}
              quote={activeAside.quote}
              messages={activeAside.messages}
              setMessages={setActiveMessages}
              charCount={view.paper?.charCount}
              paperError={view.paperError}
              paperLoading={view.paperLoading}
              onClose={onCloseAside}
            />
          ) : null}
        </div>
      </UiLanguageProvider>
    </AssistantRuntimeProvider>
  );
}

function ExplainBinder({
  bridge,
  onSelection,
  onLeaveAside,
}: {
  bridge: PanelBridge;
  onSelection: (selection: BridgeSelection) => void;
  onLeaveAside: () => void;
}) {
  const aui = useAui();
  const lang = useUiLanguage();
  useEffect(() => {
    return bridge.onExplainRequest?.((next) => {
      onLeaveAside();
      onSelection(next);
      aui.composer.setText(explainSelectionPrompt(lang));
      aui.composer.send();
    });
  }, [bridge, lang, aui, onSelection, onLeaveAside]);
  return null;
}
