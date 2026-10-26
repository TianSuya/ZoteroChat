import MarkdownIt from "markdown-it";
import { config } from "../../package.json";
import { readReplyLanguage } from "../i18n/prefs";
import type {
  BridgeNoteContext,
  BridgeSession,
  BridgeUsage,
} from "../panel-app/bridge";
import {
  appendTurn,
  archiveConversation,
  insertConversation,
  loadActiveConversation,
  loadTurns,
} from "../store/db";
import { buildToolDefinitions } from "../tools/definitions";
import { readSearchSettings } from "../tools/settings";
import type {
  AskUserRequest,
  NoteEditRequest,
  NoteEditResult,
  PaperBatchDecision,
  PaperBatchRequest,
  PaperRequest,
  ToolContext,
} from "../tools/types";
import { runAgentTurn } from "./agent";
import {
  NOTE_SYSTEM_PROMPT,
  buildNoteUserMessage,
  noteConversationKey,
} from "./notePrompt";
import { loadApiKey } from "./secrets";
import type { ChatMessage, ToolTrace } from "./types";

type DisplayRow = BridgeSession["messages"][number];

type NoteConversation = {
  key: string;
  noteID: number;
  libraryID: number;
  dbId: number | null;
  turns: ChatMessage[];
  display: DisplayRow[];
};

type NoteStreamJob = {
  cancel: () => void;
  done: Promise<void>;
};

const conversations = new Map<string, NoteConversation>();
const hydrating = new Map<string, Promise<NoteConversation>>();
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

function settings() {
  const baseUrl =
    (Zotero.Prefs.get(`${config.prefsPrefix}.apiBaseUrl`, true) as string) ||
    "https://api.deepseek.com";
  const model =
    (Zotero.Prefs.get(`${config.prefsPrefix}.model`, true) as string) ||
    "deepseek-flash";
  return { baseUrl, model };
}

function noteText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function readNote(noteID: number) {
  const item = await Zotero.Items.getAsync(noteID);
  if (!item || !(item as Zotero.Item).isNote?.()) {
    throw new Error("That item is not a standalone note.");
  }
  const noteItem = item as Zotero.Item;
  const html = noteItem.getNote();
  const text = noteText(html);
  const ctx: BridgeNoteContext = {
    noteID: noteItem.id,
    noteKey: noteItem.key,
    libraryID: noteItem.libraryID,
    title: noteItem.getNoteTitle() || "Untitled note",
    charCount: text.length,
  };
  return { item: noteItem, ctx, html, text };
}

function snapshot(
  ctx: BridgeNoteContext,
  conv: NoteConversation,
): BridgeSession {
  return {
    mode: "note",
    itemID: ctx.noteID,
    title: ctx.title,
    charCount: ctx.charCount,
    hash: "",
    note: ctx,
    messages: conv.display,
    asides: [],
    notes: [],
  };
}

async function hydrate(noteID: number): Promise<NoteConversation> {
  const { ctx } = await readNote(noteID);
  const key = noteConversationKey(ctx);
  const existing = await loadActiveConversation(ctx.libraryID, key);
  const dbId = existing?.id ?? (await insertConversation(ctx.libraryID, key));
  const turns: ChatMessage[] = [];
  const display: DisplayRow[] = [];
  if (dbId != null) {
    for (const row of await loadTurns(dbId)) {
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
  }
  const conv: NoteConversation = {
    key,
    noteID: ctx.noteID,
    libraryID: ctx.libraryID,
    dbId,
    turns,
    display,
  };
  conversations.set(key, conv);
  return conv;
}

export async function beginNoteConversation(
  noteID: number,
): Promise<BridgeSession> {
  const { ctx } = await readNote(noteID);
  const key = noteConversationKey(ctx);
  const mem = conversations.get(key);
  if (mem) return snapshot(ctx, mem);
  let pending = hydrating.get(key);
  if (!pending) {
    pending = hydrate(noteID).finally(() => {
      if (hydrating.get(key) === pending) hydrating.delete(key);
    });
    hydrating.set(key, pending);
  }
  return snapshot(ctx, await pending);
}

export async function resetNoteConversation(
  noteID: number,
): Promise<BridgeSession> {
  const { ctx } = await readNote(noteID);
  const key = noteConversationKey(ctx);
  const old = conversations.get(key);
  if (old?.dbId != null) {
    await archiveConversation(old.dbId).catch((err) =>
      ztoolkit.log("note archive failed", String(err)),
    );
  }
  conversations.delete(key);
  hydrating.delete(key);
  return snapshot(ctx, await hydrate(noteID));
}

export function renderNoteEdit(
  html: string,
  content: string,
  mode: NoteEditRequest["mode"],
): string {
  const rendered = md.render(content.trim());
  if (!rendered.trim())
    throw new Error("Refusing to write an empty note section.");
  if (mode === "replace") return rendered;
  const wrapper = html.match(
    /^(<div[^>]*data-schema-version[^>]*>)([\s\S]*)(<\/div>)$/i,
  );
  return wrapper
    ? `${wrapper[1]}${wrapper[2]}${rendered}${wrapper[3]}`
    : `${html}${rendered}`;
}

async function editNote(
  noteID: number,
  req: NoteEditRequest,
): Promise<NoteEditResult> {
  const { item, html } = await readNote(noteID);
  const next = renderNoteEdit(html, req.content, req.mode);
  item.setNote(next);
  await item.saveTx();
  return {
    noteID: item.id,
    title: item.getNoteTitle() || "Untitled note",
    charCount: noteText(next).length,
    mode: req.mode,
  };
}

export function streamNoteTurn(
  noteID: number,
  req: { question: string; userId?: string; assistantId?: string },
  handlers: {
    onDelta: (text: string) => void;
    onUsage?: (usage: BridgeUsage) => void;
    onPrefixBreak?: () => void;
    onToolTrace?: (trace: ToolTrace[]) => void;
    onAskUser?: (req: AskUserRequest) => Promise<string>;
    onConfirmPaper?: (req: PaperRequest) => Promise<boolean>;
    onPresentPapers?: (req: PaperBatchRequest) => Promise<PaperBatchDecision>;
  },
): NoteStreamJob {
  const win = Zotero.getMainWindow() as Window | null;
  if (!win) throw new Error("No Zotero main window to send from.");
  const ac = new win.AbortController();
  const done = (async () => {
    const note = await readNote(noteID);
    const key = noteConversationKey(note.ctx);
    const conv = conversations.get(key) ?? (await hydrate(noteID));
    const userWire: ChatMessage = {
      role: "user",
      content: buildNoteUserMessage(
        req.question,
        note.ctx,
        note.text,
        readReplyLanguage(),
      ),
    };
    const messages = [
      { role: "system" as const, content: NOTE_SYSTEM_PROMPT },
      ...conv.turns,
      userWire,
    ];

    const { baseUrl, model } = settings();
    const apiKey = await loadApiKey();
    const search = await readSearchSettings();
    const tools = buildToolDefinitions({
      search: search.enabled,
      download: search.allowPaperDownloads,
      askUser: true,
      note: true,
    });
    const toolCtx: ToolContext = {
      itemID: noteID,
      libraryID: note.ctx.libraryID,
      collectionIDs: (note.item as any).getCollections?.() ?? [],
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
      presentPapers: (papers) => {
        if (!handlers.onPresentPapers)
          return Promise.resolve({ action: "cancel" });
        return handlers.onPresentPapers(papers);
      },
      editNote: (edit) => editNote(noteID, edit),
    };

    const agent = await runAgentTurn({
      fetch: win.fetch.bind(win),
      baseUrl,
      apiKey,
      model,
      messages,
      tools,
      ctx: toolCtx,
      signal: ac.signal,
      handlers: {
        onDelta: handlers.onDelta,
        onUsage: handlers.onUsage,
        onToolTrace: handlers.onToolTrace,
      },
    });

    if (conversations.get(key) !== conv) {
      ztoolkit.log("note turn dropped: conversation was reset");
      return;
    }
    conv.turns.push(userWire, ...agent.newMessages);
    const userId = req.userId ?? `u-${Date.now()}`;
    const assistantId = req.assistantId ?? `a-${Date.now()}`;
    conv.display.push(
      { id: userId, role: "user", content: req.question },
      {
        id: assistantId,
        role: "assistant",
        content: agent.content,
        toolTrace: agent.toolTrace.length ? agent.toolTrace : undefined,
      },
    );

    if (conv.dbId != null) {
      const dbId = conv.dbId;
      try {
        await appendTurn(dbId, {
          role: "user",
          wireContent: userWire.content,
          displayContent: req.question,
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
      } catch (err) {
        ztoolkit.log("note persist failed", String(err));
      }
    }
  })();
  return { cancel: () => ac.abort(), done };
}
