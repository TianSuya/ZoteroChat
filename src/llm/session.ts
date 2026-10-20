import { config } from "../../package.json";
import { extractPaper, type PaperRecord } from "../context/extract";
import { readReplyLanguage } from "../i18n/prefs";
import {
  appendAsideTurn,
  appendTurn,
  archiveConversation,
  deleteNote as deleteNoteRow,
  insertAside,
  insertConversation,
  insertNote,
  loadActiveConversation,
  loadAsides,
  loadDocument,
  loadNotes,
  loadTurns,
  saveDocument,
  updateNote as updateNoteRow,
} from "../store/db";
import { buildToolDefinitions } from "../tools/definitions";
import { searchWeb } from "../tools/search";
import { readSearchSettings } from "../tools/settings";
import type { AskUserRequest, PaperRequest, ToolContext } from "../tools/types";
import { encodeUserContent } from "../ui/thread/userContent";
import { runAgentTurn } from "./agent";
import { chatCompletionsUrl } from "./client/chatCompletions";
import { buildRequestMessages, frozenPrefix } from "./prefixBuilder";
import { PrefixLedger } from "./prefixLedger";
import { clearSecretCache, loadApiKey } from "./secrets";
import type {
  ChatMessage,
  LoadedAside,
  LoadedNote,
  PaperStatus,
  Selection,
  SessionSnapshot,
  ToolTrace,
  UsageSnapshot,
} from "./types";

type DisplayRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolTrace?: ToolTrace[];
};

type Conversation = {
  itemID: number;
  dbId: number | null;
  paper: PaperRecord;
  prefix: ChatMessage[];
  turns: ChatMessage[];
  ledger: PrefixLedger;
};

type Aside = {
  id: string;
  itemID: number;
  quote: string;
  forkTurns: ChatMessage[];
  turns: ChatMessage[];
  ledger: PrefixLedger;
};

const papers = new Map<number, PaperRecord>();
const conversations = new Map<number, Conversation>();
const hydrating = new Map<number, Promise<Conversation>>();
const epochs = new Map<number, number>();
const asides = new Map<string, Aside>();
const mainDisplay = new Map<number, DisplayRow[]>();
const asideDisplay = new Map<string, DisplayRow[]>();
const mainNotes = new Map<number, LoadedNote[]>();
const asideMeta = new Map<
  string,
  { sourceMessageId: string; fromSelection: boolean }
>();

function settings() {
  const baseUrl =
    (Zotero.Prefs.get(`${config.prefsPrefix}.apiBaseUrl`, true) as string) ||
    "https://api.deepseek.com";
  const model =
    (Zotero.Prefs.get(`${config.prefsPrefix}.model`, true) as string) ||
    "deepseek-flash";
  return { baseUrl, model };
}

function dumpPayload(messages: ChatMessage[]) {
  const dump = Zotero.Prefs.get(`${config.prefsPrefix}.debugDumpPayload`, true);
  if (!dump) return;
  ztoolkit.log(
    "payload",
    messages.map((m) => `${m.role}:${m.content.length}`).join(" "),
  );
}

function paperStatus(paper: PaperRecord): PaperStatus {
  return {
    itemID: paper.itemID,
    title: paper.title,
    charCount: paper.charCount,
    hash: paper.hash,
  };
}

function snapshotOf(conv: Conversation): SessionSnapshot {
  const asideList: LoadedAside[] = [];
  for (const aside of asides.values()) {
    if (aside.itemID !== conv.itemID) continue;
    const meta = asideMeta.get(aside.id);
    asideList.push({
      id: aside.id,
      sourceMessageId: meta?.sourceMessageId ?? "",
      quote: aside.quote,
      fromSelection: meta?.fromSelection ?? true,
      messages: asideDisplay.get(aside.id) ?? [],
    });
  }
  return {
    ...paperStatus(conv.paper),
    messages: mainDisplay.get(conv.itemID) ?? [],
    asides: asideList,
    notes: mainNotes.get(conv.itemID) ?? [],
  };
}

function hydrateLedger(
  prefix: ChatMessage[],
  turns: ChatMessage[],
): PrefixLedger {
  const ledger = new PrefixLedger();
  if (turns.length) ledger.commit([...prefix, ...turns]);
  return ledger;
}

async function persistQuiet(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    ztoolkit.log("persist failed", label, String(err));
  }
}

export async function ensurePaper(itemID: number): Promise<PaperStatus> {
  const item = await Zotero.Items.getAsync(itemID);
  const live = item ? item : undefined;
  if (!live) throw new Error("Item not found.");
  const mtime = Number(live.attachmentModificationTime ?? 0);
  const revision = `${live.libraryID}:${live.key}:${mtime}`;
  const mem = papers.get(itemID);
  if (mem && mem.revision === revision) return paperStatus(mem);

  const stored = await loadDocument(live.libraryID, live.key);
  if (stored && stored.revision === revision) {
    const paper: PaperRecord = {
      itemID,
      libraryID: stored.libraryID,
      attachmentKey: stored.itemKey,
      revision: stored.revision,
      title: stored.title,
      metadata: stored.metadata,
      text: stored.text,
      hash: stored.hash,
      charCount: stored.charCount,
    };
    papers.set(itemID, paper);
    return paperStatus(paper);
  }

  const paper = await extractPaper(itemID);
  papers.set(itemID, paper);
  await persistQuiet("document", () =>
    saveDocument({
      libraryID: paper.libraryID,
      itemKey: paper.attachmentKey,
      revision: paper.revision,
      title: paper.title,
      metadata: paper.metadata,
      text: paper.text,
      charCount: paper.charCount,
      hash: paper.hash,
    }),
  );
  ztoolkit.log("extracted paper", paper.charCount, "chars", paper.hash);
  return paperStatus(paper);
}

function dropAsidesFor(itemID: number) {
  for (const [id, aside] of asides) {
    if (aside.itemID === itemID) {
      asides.delete(id);
      asideMeta.delete(id);
      asideDisplay.delete(id);
    }
  }
}

async function hydrateConversation(
  itemID: number,
  epoch: number,
): Promise<Conversation> {
  if ((epochs.get(itemID) ?? 0) !== epoch) {
    throw new Error("Conversation was reset while loading.");
  }
  await ensurePaper(itemID);
  const paper = papers.get(itemID)!;
  const prefix = frozenPrefix(paper.metadata, paper.text);
  const existing = await loadActiveConversation(
    paper.libraryID,
    paper.attachmentKey,
  );
  let dbId = existing?.id ?? null;
  if (dbId == null) {
    dbId = await insertConversation(paper.libraryID, paper.attachmentKey);
  }

  const turns: ChatMessage[] = [];
  const display: DisplayRow[] = [];
  let notes: LoadedNote[] = [];
  if (dbId != null) {
    const stored = await loadTurns(dbId);
    for (const row of stored) {
      turns.push({
        role: row.role,
        content: row.wireContent,
        tool_calls: row.toolCalls,
        tool_call_id: row.toolCallId,
        name: row.toolName,
      });
      if (row.visible && row.role !== "tool") {
        display.push({
          id: row.displayId,
          role: row.role,
          content: row.displayContent,
          toolTrace: row.toolTrace,
        });
      }
    }
    notes = await loadNotes(dbId);
  }

  if ((epochs.get(itemID) ?? 0) !== epoch) {
    throw new Error("Conversation was reset while loading.");
  }

  const conv: Conversation = {
    itemID,
    dbId,
    paper,
    prefix,
    turns,
    ledger: hydrateLedger(prefix, turns),
  };
  conversations.set(itemID, conv);
  mainDisplay.set(itemID, display);
  mainNotes.set(itemID, notes);

  dropAsidesFor(itemID);
  if (dbId != null) {
    const loaded = await loadAsides(dbId);
    for (const row of loaded) {
      const forkTurns = turns.slice(0, row.forkSeq);
      const asideTurns: ChatMessage[] = [];
      const asideMsgs: DisplayRow[] = [];
      for (const msg of row.messages) {
        asideTurns.push({
          role: msg.role,
          content: msg.wireContent,
          tool_calls: msg.toolCalls,
          tool_call_id: msg.toolCallId,
          name: msg.toolName,
        });
        if (msg.visible && msg.role !== "tool") {
          asideMsgs.push({
            id: msg.displayId,
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.displayContent,
            toolTrace: msg.toolTrace,
          });
        }
      }
      asides.set(row.id, {
        id: row.id,
        itemID,
        quote: row.quote,
        forkTurns,
        turns: asideTurns,
        ledger: hydrateLedger(prefix, [...forkTurns, ...asideTurns]),
      });
      asideMeta.set(row.id, {
        sourceMessageId: row.sourceMessageId,
        fromSelection: row.fromSelection,
      });
      asideDisplay.set(row.id, asideMsgs);
    }
  }
  return conv;
}

/** Open the active conversation for this PDF, restoring history from sqlite. */
export async function beginConversation(
  itemID: number,
): Promise<SessionSnapshot> {
  const mem = conversations.get(itemID);
  if (mem) return snapshotOf(mem);

  // The panel calls this on mount while a quick prompt may already have
  // started a turn. Share one hydration so two callers cannot create two
  // active conversations for the same PDF.
  let pending = hydrating.get(itemID);
  if (!pending) {
    pending = hydrateConversation(itemID, epochs.get(itemID) ?? 0).finally(
      () => {
        if (hydrating.get(itemID) === pending) hydrating.delete(itemID);
      },
    );
    hydrating.set(itemID, pending);
  }
  const conv = await pending;
  return snapshotOf(conv);
}

/** Archive the current thread and start a blank one for this PDF. */
export async function resetConversation(
  itemID: number,
): Promise<SessionSnapshot> {
  epochs.set(itemID, (epochs.get(itemID) ?? 0) + 1);
  hydrating.delete(itemID);
  const mem = conversations.get(itemID);
  if (mem?.dbId != null) {
    await persistQuiet("archive", () => archiveConversation(mem.dbId!));
  }
  dropAsidesFor(itemID);
  mainDisplay.delete(itemID);
  conversations.delete(itemID);
  await ensurePaper(itemID);
  const paper = papers.get(itemID)!;
  const dbId = await insertConversation(paper.libraryID, paper.attachmentKey);
  const prefix = frozenPrefix(paper.metadata, paper.text);
  const conv: Conversation = {
    itemID,
    dbId,
    paper,
    prefix,
    turns: [],
    ledger: new PrefixLedger(),
  };
  conversations.set(itemID, conv);
  mainDisplay.set(itemID, []);
  mainNotes.set(itemID, []);
  return snapshotOf(conv);
}

export function beginAside(
  itemID: number,
  req: {
    id: string;
    quote: string;
    sourceMessageId: string;
    fromSelection?: boolean;
  },
): void {
  const conv = conversations.get(itemID);
  if (!conv) throw new Error("No main conversation to fork.");
  if (asides.has(req.id)) return;
  const quote = req.quote.trim();
  if (!quote) throw new Error("Aside quote is empty.");
  const forkTurns = conv.turns.map((m) => ({ ...m }));
  const ledger = new PrefixLedger();
  ledger.commit([...conv.prefix, ...forkTurns]);
  asides.set(req.id, {
    id: req.id,
    itemID,
    quote,
    forkTurns,
    turns: [],
    ledger,
  });
  asideMeta.set(req.id, {
    sourceMessageId: req.sourceMessageId,
    fromSelection: req.fromSelection !== false,
  });
  asideDisplay.set(req.id, []);
  if (conv.dbId != null) {
    void persistQuiet("aside", () =>
      insertAside({
        id: req.id,
        conversationId: conv.dbId!,
        sourceMessageId: req.sourceMessageId,
        quote,
        fromSelection: req.fromSelection !== false,
        forkSeq: forkTurns.length,
      }),
    );
  }
}

export type StreamJob = {
  cancel: () => void;
  done: Promise<void>;
};

export function streamTurn(
  itemID: number,
  req: {
    question: string;
    selection?: Selection | null;
    userId?: string;
    assistantId?: string;
  },
  handlers: {
    onDelta: (text: string) => void;
    onUsage?: (usage: UsageSnapshot) => void;
    onPrefixBreak?: () => void;
    onToolTrace?: (trace: ToolTrace[]) => void;
    onAskUser?: (req: AskUserRequest) => Promise<string>;
    onConfirmPaper?: (req: PaperRequest) => Promise<boolean>;
  },
): StreamJob {
  const win = Zotero.getMainWindow() as Window | null;
  if (!win) throw new Error("No Zotero main window to send from.");
  const ac = new win.AbortController();

  const done = (async () => {
    let conv = conversations.get(itemID);
    if (!conv) {
      await beginConversation(itemID);
      conv = conversations.get(itemID)!;
    }
    const messages = buildRequestMessages({
      prefix: conv.prefix,
      turns: conv.turns,
      question: req.question,
      selection: req.selection,
      language: readReplyLanguage(),
    });
    const check = conv.ledger.check(messages);
    if (!check.ok) {
      ztoolkit.log("prefix_break", check.prefixHash);
      handlers.onPrefixBreak?.();
    }
    dumpPayload(messages);

    const { baseUrl, model } = settings();
    const key = await loadApiKey();
    const search = await readSearchSettings();
    const tools = buildToolDefinitions({
      search: search.enabled,
      download: search.allowPaperDownloads,
    });

    const item = await Zotero.Items.getAsync(itemID);
    const parent =
      item && item.parentID ? await Zotero.Items.getAsync(item.parentID) : item;
    const collectionIDs = parent ? parent.getCollections() : [];
    const ctx: ToolContext = {
      itemID,
      libraryID: item ? item.libraryID : Zotero.Libraries.userLibraryID,
      collectionIDs,
      fetch: win.fetch.bind(win),
      searchBaseUrl: search.baseUrl,
      searchApiKey: search.apiKey,
      allowPaperDownloads: search.allowPaperDownloads,
      askUser: (ask) => {
        if (!handlers.onAskUser) throw new Error("This panel cannot ask.");
        return handlers.onAskUser(ask);
      },
      confirmPaper: (paper) => {
        if (!handlers.onConfirmPaper) return Promise.resolve(false);
        return handlers.onConfirmPaper(paper);
      },
    };

    const agent = await runAgentTurn({
      fetch: win.fetch.bind(win),
      baseUrl,
      apiKey: key,
      model,
      messages,
      tools,
      ctx,
      signal: ac.signal,
      handlers: {
        onDelta: handlers.onDelta,
        onUsage: handlers.onUsage,
        onToolTrace: handlers.onToolTrace,
      },
    });

    const userWire = messages[messages.length - 1]!;
    if (conversations.get(itemID) !== conv) {
      // The user started a new conversation while this stream was running.
      // Do not leak the old turn into the new thread.
      ztoolkit.log("turn dropped: conversation was reset");
      return;
    }
    conv.turns.push(userWire, ...agent.newMessages);
    conv.ledger.commit([...messages, ...agent.newMessages]);

    const userId = req.userId ?? `u-${Date.now()}`;
    const assistantId = req.assistantId ?? `a-${Date.now()}`;
    const userDisplay: DisplayRow = {
      id: userId,
      role: "user",
      content: encodeUserContent(req.question, req.selection),
    };
    const assistantDisplay: DisplayRow = {
      id: assistantId,
      role: "assistant",
      content: agent.content,
      toolTrace: agent.toolTrace.length ? agent.toolTrace : undefined,
    };
    const shown = mainDisplay.get(itemID) ?? [];
    shown.push(userDisplay, assistantDisplay);
    mainDisplay.set(itemID, shown);

    if (conv.dbId != null) {
      const dbId = conv.dbId;
      await persistQuiet("turn", async () => {
        await appendTurn(dbId, {
          role: "user",
          wireContent: userWire.content,
          displayContent: userDisplay.content,
          displayId: userId,
          visible: true,
        });
        for (let i = 0; i < agent.newMessages.length; i += 1) {
          const message = agent.newMessages[i]!;
          const isFinal = i === agent.newMessages.length - 1;
          await appendTurn(dbId, {
            role: message.role as "user" | "assistant" | "tool",
            wireContent: message.content,
            displayContent: isFinal ? agent.content : "",
            displayId: isFinal ? assistantId : "",
            visible: isFinal,
            toolCalls: message.tool_calls,
            toolCallId: message.tool_call_id,
            toolName: message.name,
            toolTrace:
              isFinal && agent.toolTrace.length ? agent.toolTrace : undefined,
          });
        }
      });
    }
  })();

  return { cancel: () => ac.abort(), done };
}

export function streamAsideTurn(
  itemID: number,
  asideId: string,
  req: { question: string; userId?: string; assistantId?: string },
  handlers: {
    onDelta: (text: string) => void;
    onUsage?: (usage: UsageSnapshot) => void;
    onPrefixBreak?: () => void;
    onToolTrace?: (trace: ToolTrace[]) => void;
  },
): StreamJob {
  const win = Zotero.getMainWindow() as Window | null;
  if (!win) throw new Error("No Zotero main window to send from.");
  const ac = new win.AbortController();

  const done = (async () => {
    const conv = conversations.get(itemID);
    const aside = asides.get(asideId);
    if (!conv || !aside || aside.itemID !== itemID) {
      throw new Error("Aside conversation is missing.");
    }
    const messages = buildRequestMessages({
      prefix: conv.prefix,
      turns: [...aside.forkTurns, ...aside.turns],
      question: req.question,
      selection: null,
      language: readReplyLanguage(),
      asideQuote: aside.turns.length === 0 ? aside.quote : null,
    });
    const check = aside.ledger.check(messages);
    if (!check.ok) {
      ztoolkit.log("prefix_break aside", check.prefixHash);
      handlers.onPrefixBreak?.();
    }
    dumpPayload(messages);

    const { baseUrl, model } = settings();
    const key = await loadApiKey();
    const search = await readSearchSettings();
    const tools = buildToolDefinitions({
      search: search.enabled,
      download: false,
      askUser: false,
    });

    const item = await Zotero.Items.getAsync(itemID);
    const parent =
      item && item.parentID ? await Zotero.Items.getAsync(item.parentID) : item;
    const collectionIDs = parent ? parent.getCollections() : [];
    const ctx: ToolContext = {
      itemID,
      libraryID: item ? item.libraryID : Zotero.Libraries.userLibraryID,
      collectionIDs,
      fetch: win.fetch.bind(win),
      searchBaseUrl: search.baseUrl,
      searchApiKey: search.apiKey,
      allowPaperDownloads: false,
      askUser: () => {
        throw new Error("Ask User is only available in the main thread.");
      },
      confirmPaper: () => Promise.resolve(false),
    };

    const agent = await runAgentTurn({
      fetch: win.fetch.bind(win),
      baseUrl,
      apiKey: key,
      model,
      messages,
      tools,
      ctx,
      signal: ac.signal,
      handlers: {
        onDelta: handlers.onDelta,
        onUsage: handlers.onUsage,
        onToolTrace: handlers.onToolTrace,
      },
    });

    if (asides.get(asideId) !== aside || conversations.get(itemID) !== conv) {
      ztoolkit.log("aside turn dropped: conversation was reset");
      return;
    }

    const userWire = messages[messages.length - 1]!;
    aside.turns.push(userWire, ...agent.newMessages);
    aside.ledger.commit([...messages, ...agent.newMessages]);

    const userId = req.userId ?? `u-${Date.now()}`;
    const assistantId = req.assistantId ?? `a-${Date.now()}`;
    const shown = asideDisplay.get(asideId) ?? [];
    shown.push(
      { id: userId, role: "user", content: req.question },
      {
        id: assistantId,
        role: "assistant",
        content: agent.content,
        toolTrace: agent.toolTrace.length ? agent.toolTrace : undefined,
      },
    );
    asideDisplay.set(asideId, shown);

    await persistQuiet("aside-turn", async () => {
      await appendAsideTurn(asideId, {
        role: "user",
        wireContent: userWire.content,
        displayContent: req.question,
        displayId: userId,
        visible: true,
      });
      for (let i = 0; i < agent.newMessages.length; i += 1) {
        const message = agent.newMessages[i]!;
        const isFinal = i === agent.newMessages.length - 1;
        await appendAsideTurn(asideId, {
          role: message.role as "user" | "assistant" | "tool",
          wireContent: message.content,
          displayContent: isFinal ? agent.content : "",
          displayId: isFinal ? assistantId : "",
          visible: isFinal,
          toolCalls: message.tool_calls,
          toolCallId: message.tool_call_id,
          toolName: message.name,
          toolTrace:
            isFinal && agent.toolTrace.length ? agent.toolTrace : undefined,
        });
      }
    });
  })();

  return { cancel: () => ac.abort(), done };
}

export async function saveNote(
  itemID: number,
  req: { id: string; messageId: string; quote: string; note: string },
): Promise<LoadedNote> {
  const conv = conversations.get(itemID);
  if (!conv) throw new Error("Open the conversation before adding a note.");
  const quote = req.quote.trim();
  const body = req.note.trim();
  if (!quote) throw new Error("Note quote is empty.");
  if (!body) throw new Error("Note text is empty.");

  let note: LoadedNote;
  if (conv.dbId != null) {
    note = await insertNote(conv.dbId, {
      id: req.id,
      messageId: req.messageId,
      quote,
      note: body,
    });
  } else {
    const now = Date.now();
    note = {
      id: req.id,
      messageId: req.messageId,
      quote,
      note: body,
      createdAt: now,
      updatedAt: now,
    };
  }

  const notes = mainNotes.get(itemID) ?? [];
  notes.push(note);
  mainNotes.set(itemID, notes);
  return note;
}

export async function updateNote(
  itemID: number,
  req: { id: string; note: string },
): Promise<LoadedNote | null> {
  const conv = conversations.get(itemID);
  if (!conv) throw new Error("Open the conversation before editing a note.");
  const body = req.note.trim();
  if (!body) throw new Error("Note text is empty.");

  let updated: LoadedNote | null = null;
  if (conv.dbId != null) {
    updated = await updateNoteRow(req.id, body);
  }
  const notes = mainNotes.get(itemID) ?? [];
  const index = notes.findIndex((note) => note.id === req.id);
  if (index < 0) return updated;
  const next: LoadedNote = updated ?? {
    ...notes[index]!,
    note: body,
    updatedAt: Date.now(),
  };
  notes[index] = next;
  mainNotes.set(itemID, notes);
  return next;
}

export async function deleteNote(itemID: number, id: string): Promise<void> {
  const conv = conversations.get(itemID);
  if (!conv) return;
  if (conv.dbId != null) await deleteNoteRow(id);
  const notes = mainNotes.get(itemID) ?? [];
  mainNotes.set(
    itemID,
    notes.filter((note) => note.id !== id),
  );
}

export async function testSearchConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const search = await readSearchSettings();
    if (!search.apiKey) {
      return { ok: false, message: "No search API key or main API key." };
    }
    const win = Zotero.getMainWindow() as Window | null;
    if (!win) return { ok: false, message: "No Zotero window." };
    const results = await searchWeb({
      fetch: win.fetch.bind(win),
      baseUrl: search.baseUrl,
      apiKey: search.apiKey,
      query: "DeepSeek API",
      count: 1,
    });
    return {
      ok: true,
      message: `${results.length} result${results.length === 1 ? "" : "s"}`,
    };
  } catch (err) {
    return { ok: false, message: String((err as Error)?.message ?? err) };
  }
}

export async function testConnection(): Promise<{
  ok: boolean;
  message: string;
  model?: string;
}> {
  try {
    const key = await loadApiKey();
    const { baseUrl, model } = settings();
    const win = Zotero.getMainWindow() as Window | null;
    if (!win) return { ok: false, message: "No Zotero window." };
    const res = await win.fetch(chatCompletionsUrl(baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: "Reply with the single word pong." },
        ],
        thinking: { type: "disabled" },
        max_tokens: 8,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        message: `${res.status} ${res.statusText}${body ? `: ${body.slice(0, 180)}` : ""}`,
      };
    }
    return { ok: true, message: model, model };
  } catch (err) {
    return { ok: false, message: String((err as Error)?.message ?? err) };
  }
}

export { clearSecretCache };
