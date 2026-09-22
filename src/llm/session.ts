import { config } from "../../package.json";
import { extractPaper, type PaperRecord } from "../context/extract";
import { readReplyLanguage } from "../i18n/prefs";
import {
  appendAsideTurn,
  appendTurn,
  archiveConversation,
  insertAside,
  insertConversation,
  loadActiveConversation,
  loadAsides,
  loadDocument,
  loadTurns,
  saveDocument,
} from "../store/db";
import { encodeUserContent } from "../ui/thread/userContent";
import {
  chatCompletionsUrl,
  streamChatCompletions,
} from "./client/chatCompletions";
import { buildRequestMessages, frozenPrefix } from "./prefixBuilder";
import { PrefixLedger } from "./prefixLedger";
import { clearSecretCache, loadApiKey } from "./secrets";
import type {
  ChatMessage,
  LoadedAside,
  PaperStatus,
  Selection,
  SessionSnapshot,
  UsageSnapshot,
} from "./types";

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
const asides = new Map<string, Aside>();
const mainDisplay = new Map<
  number,
  { id: string; role: "user" | "assistant"; content: string }[]
>();
const asideDisplay = new Map<
  string,
  { id: string; role: "user" | "assistant"; content: string }[]
>();
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

async function hydrateConversation(itemID: number): Promise<Conversation> {
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
  const display: { id: string; role: "user" | "assistant"; content: string }[] =
    [];
  if (dbId != null) {
    const stored = await loadTurns(dbId);
    for (const row of stored) {
      turns.push({ role: row.role, content: row.wireContent });
      display.push({
        id: row.displayId,
        role: row.role,
        content: row.displayContent,
      });
    }
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

  dropAsidesFor(itemID);
  if (dbId != null) {
    const loaded = await loadAsides(dbId);
    for (const row of loaded) {
      const forkTurns = turns.slice(0, row.forkSeq);
      const asideTurns: ChatMessage[] = [];
      const asideMsgs: {
        id: string;
        role: "user" | "assistant";
        content: string;
      }[] = [];
      for (const msg of row.messages) {
        asideTurns.push({ role: msg.role, content: msg.wireContent });
        asideMsgs.push({
          id: msg.displayId,
          role: msg.role,
          content: msg.displayContent,
        });
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
  const conv = await hydrateConversation(itemID);
  return snapshotOf(conv);
}

/** Archive the current thread and start a blank one for this PDF. */
export async function resetConversation(
  itemID: number,
): Promise<SessionSnapshot> {
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
    const full = await streamChatCompletions({
      fetch: win.fetch.bind(win),
      baseUrl,
      apiKey: key,
      model,
      messages,
      signal: ac.signal,
      handlers: {
        onDelta: handlers.onDelta,
        onUsage: handlers.onUsage,
      },
    });
    const userWire = messages[messages.length - 1]!;
    const assistantWire: ChatMessage = { role: "assistant", content: full };
    conv.turns.push(userWire, assistantWire);
    conv.ledger.commit([...messages, assistantWire]);

    const userId = req.userId ?? `u-${Date.now()}`;
    const assistantId = req.assistantId ?? `a-${Date.now()}`;
    const userDisplay = {
      id: userId,
      role: "user" as const,
      content: encodeUserContent(req.question, req.selection),
    };
    const assistantDisplay = {
      id: assistantId,
      role: "assistant" as const,
      content: full,
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
        });
        await appendTurn(dbId, {
          role: "assistant",
          wireContent: full,
          displayContent: full,
          displayId: assistantId,
        });
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
    const full = await streamChatCompletions({
      fetch: win.fetch.bind(win),
      baseUrl,
      apiKey: key,
      model,
      messages,
      signal: ac.signal,
      handlers: {
        onDelta: handlers.onDelta,
        onUsage: handlers.onUsage,
      },
    });
    const userWire = messages[messages.length - 1]!;
    const assistantWire: ChatMessage = { role: "assistant", content: full };
    aside.turns.push(userWire, assistantWire);
    aside.ledger.commit([...messages, assistantWire]);

    const userId = req.userId ?? `u-${Date.now()}`;
    const assistantId = req.assistantId ?? `a-${Date.now()}`;
    const shown = asideDisplay.get(asideId) ?? [];
    shown.push(
      { id: userId, role: "user", content: req.question },
      { id: assistantId, role: "assistant", content: full },
    );
    asideDisplay.set(asideId, shown);

    await persistQuiet("aside-turn", async () => {
      await appendAsideTurn(asideId, {
        role: "user",
        wireContent: userWire.content,
        displayContent: req.question,
        displayId: userId,
      });
      await appendAsideTurn(asideId, {
        role: "assistant",
        wireContent: full,
        displayContent: full,
        displayId: assistantId,
      });
    });
  })();

  return { cancel: () => ac.abort(), done };
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
