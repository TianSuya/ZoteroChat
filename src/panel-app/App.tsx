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
import { NoteEditor } from "../ui/thread/NoteEditor";
import {
  NoteActionsProvider,
  type NoteActions,
  type NoteEditorRequest,
} from "../ui/thread/noteContext";
import type { BridgeNote, BridgeSelection, PanelBridge } from "./bridge";
import { report } from "../utils/report";

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
    void bridge.resetConversation().finally(() => {
      setSession((n) => n + 1);
    });
  }, [bridge]);

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
  const [notes, setNotes] = useState<BridgeNote[]>([]);
  const [noteEditor, setNoteEditor] = useState<NoteEditorRequest | null>(null);
  const [activeAsideId, setActiveAsideId] = useState<string | null>(null);
  const activeAsideIdRef = useRef<string | null>(null);
  activeAsideIdRef.current = activeAsideId;
  const mainRootRef = useRef<HTMLDivElement>(null);

  const activeAside = asides.find((a) => a.id === activeAsideId) ?? null;

  useEffect(() => {
    setNotes(view.notes);
  }, [view.notes]);

  const notesFor = useCallback(
    (messageId: string) => notes.filter((note) => note.messageId === messageId),
    [notes],
  );
  const openNewNote = useCallback(
    (messageId: string, quote: string, rect?: NoteEditorRequest["rect"]) => {
      setNoteEditor({ messageId, quote, rect });
    },
    [],
  );
  const openExistingNote = useCallback(
    (note: BridgeNote, rect?: NoteEditorRequest["rect"]) => {
      setNoteEditor({
        messageId: note.messageId,
        quote: note.quote,
        note,
        rect,
      });
    },
    [],
  );
  const noteActions = useMemo<NoteActions>(
    () => ({
      notesFor,
      openNew: openNewNote,
      openExisting: openExistingNote,
    }),
    [notesFor, openExistingNote, openNewNote],
  );

  const savingNoteRef = useRef(false);
  const saveNote = useCallback(
    async (text: string) => {
      const editor = noteEditor;
      if (!editor || savingNoteRef.current) return;
      savingNoteRef.current = true;
      try {
        if (editor.note) {
          const updated = await bridge.updateNote({
            id: editor.note.id,
            note: text,
          });
          if (updated) {
            setNotes((prev) =>
              prev.map((note) => (note.id === updated.id ? updated : note)),
            );
          }
        } else {
          const created = await bridge.saveNote({
            id: generateId(),
            messageId: editor.messageId,
            quote: editor.quote,
            note: text,
          });
          setNotes((prev) => [...prev, created]);
        }
        setNoteEditor(null);
      } catch (err) {
        report("note save failed", String(err));
      } finally {
        savingNoteRef.current = false;
      }
    },
    [bridge, noteEditor],
  );

  const removeNote = useCallback(async () => {
    const editor = noteEditor;
    if (!editor?.note) return;
    try {
      await bridge.deleteNote(editor.note.id);
      setNotes((prev) => prev.filter((note) => note.id !== editor.note!.id));
      setNoteEditor(null);
    } catch (err) {
      report("note delete failed", String(err));
    }
  }, [bridge, noteEditor]);

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
    setAsides(
      view.restoredAsides.map((a) => ({
        id: a.id,
        sourceMessageId: a.sourceMessageId,
        quote: a.quote,
        fromSelection: a.fromSelection,
        messages: a.messages,
      })),
    );
  }, [view.restoredAsides]);

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
      bridge.beginAside({
        id,
        quote,
        sourceMessageId,
        fromSelection: origin === "selection",
      });
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
      setNoteEditor(null);
    },
    [bridge],
  );

  const onOpenAside = useCallback((asideId: string) => {
    setActiveAsideId(asideId);
    setNoteEditor(null);
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

  const noteMode = view.mode === "note";
  const thread = (
    <Thread
      mode={view.mode}
      noteName={view.note?.title}
      noteChars={view.note?.charCount}
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
      pendingPrompt={view.pendingPrompt}
      onAnswerPrompt={view.answerPrompt}
      onSkipPrompt={view.skipPrompt}
    >
      {children}
    </Thread>
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <UiLanguageProvider language={uiLanguage}>
        {noteMode ? null : (
          <ExplainBinder
            bridge={bridge}
            onSelection={commitSelection}
            onLeaveAside={onCloseAside}
          />
        )}
        <div className="relative h-full min-h-0">
          {noteMode ? (
            <div ref={mainRootRef} className="h-full min-h-0">
              {thread}
            </div>
          ) : (
            <AsideActionsProvider value={asideActions}>
              <div ref={mainRootRef} className="h-full min-h-0">
                <NoteActionsProvider value={noteActions}>
                  {thread}
                </NoteActionsProvider>
              </div>
            </AsideActionsProvider>
          )}
          {!noteMode && activeAside ? (
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
          {!noteMode && noteEditor ? (
            <NoteEditor
              request={noteEditor}
              onClose={() => setNoteEditor(null)}
              onSave={(text) => {
                void saveNote(text);
              }}
              onDelete={
                noteEditor.note
                  ? () => {
                      void removeNote();
                    }
                  : undefined
              }
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
