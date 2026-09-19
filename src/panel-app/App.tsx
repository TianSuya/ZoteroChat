import { AssistantRuntimeProvider, useAui } from "@assistant-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AssistantProbe } from "../dev/assistantProbe";
import { RadixProbe } from "../dev/radixProbe";
import { explainSelectionPrompt } from "../i18n/commands";
import type { UiLanguage } from "../i18n/languages";
import { useThreadRuntime } from "../runtime/externalStore";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { UiLanguageProvider, useUiLanguage } from "../ui/ReplyLanguage";
import { Thread } from "../ui/Thread";
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
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <UiLanguageProvider language={uiLanguage}>
        <ExplainBinder bridge={bridge} onSelection={commitSelection} />
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
      </UiLanguageProvider>
    </AssistantRuntimeProvider>
  );
}

function ExplainBinder({
  bridge,
  onSelection,
}: {
  bridge: PanelBridge;
  onSelection: (selection: BridgeSelection) => void;
}) {
  const aui = useAui();
  const lang = useUiLanguage();
  useEffect(() => {
    return bridge.onExplainRequest?.((next) => {
      onSelection(next);
      aui.composer.setText(explainSelectionPrompt(lang));
      aui.composer.send();
    });
  }, [bridge, lang, aui, onSelection]);
  return null;
}
