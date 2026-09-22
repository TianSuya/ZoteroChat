import { config } from "../../package.json";
import { extractPaper, type PaperRecord } from "../context/extract";
import { readReplyLanguage } from "../i18n/prefs";
import {
  chatCompletionsUrl,
  streamChatCompletions,
} from "./client/chatCompletions";
import { buildRequestMessages, frozenPrefix } from "./prefixBuilder";
import { PrefixLedger } from "./prefixLedger";
import { clearSecretCache, loadApiKey } from "./secrets";
import type {
  ChatMessage,
  PaperStatus,
  Selection,
  UsageSnapshot,
} from "./types";

type Conversation = {
  itemID: number;
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

export async function ensurePaper(itemID: number): Promise<PaperStatus> {
  const item = await Zotero.Items.getAsync(itemID);
  const live = item ? item : undefined;
  const mtime = Number(live?.attachmentModificationTime ?? 0);
  const revision = `${live?.libraryID}:${live?.key}:${mtime}`;
  const cached = papers.get(itemID);
  if (cached && cached.revision === revision) {
    return {
      itemID,
      title: cached.title,
      charCount: cached.charCount,
      hash: cached.hash,
    };
  }
  const paper = await extractPaper(itemID);
  papers.set(itemID, paper);
  ztoolkit.log("extracted paper", paper.charCount, "chars", paper.hash);
  return {
    itemID,
    title: paper.title,
    charCount: paper.charCount,
    hash: paper.hash,
  };
}

function dropAsidesFor(itemID: number) {
  for (const [id, aside] of asides) {
    if (aside.itemID === itemID) asides.delete(id);
  }
}

export async function beginConversation(itemID: number): Promise<PaperStatus> {
  const status = await ensurePaper(itemID);
  const paper = papers.get(itemID)!;
  dropAsidesFor(itemID);
  conversations.set(itemID, {
    itemID,
    paper,
    prefix: frozenPrefix(paper.metadata, paper.text),
    turns: [],
    ledger: new PrefixLedger(),
  });
  return status;
}

export function beginAside(
  itemID: number,
  req: { id: string; quote: string },
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
}

export type StreamJob = {
  cancel: () => void;
  done: Promise<void>;
};

export function streamTurn(
  itemID: number,
  req: { question: string; selection?: Selection | null },
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
    conv.turns.push(messages[messages.length - 1]!, {
      role: "assistant",
      content: full,
    });
    conv.ledger.commit([...messages, { role: "assistant", content: full }]);
  })();

  return { cancel: () => ac.abort(), done };
}

export function streamAsideTurn(
  itemID: number,
  asideId: string,
  req: { question: string },
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
    aside.turns.push(messages[messages.length - 1]!, {
      role: "assistant",
      content: full,
    });
    aside.ledger.commit([...messages, { role: "assistant", content: full }]);
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
