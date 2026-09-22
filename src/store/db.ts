/**
 * Profile-local sqlite for conversations. Independent of zotero.sqlite.
 *
 * Must be opened with an **absolute path**. `new Zotero.DBConnection("zoterochat")`
 * is treated as an internal Zotero DB (`_externalDB = false`). Then a leftover
 * WAL file is "unclean shutdown" and Zotero runs `PRAGMA integrity_check` with
 * the "checking database integrity" progress meter — and hangs, because the
 * paper text in this file is huge.
 */

const SCHEMA_VERSION = 1;

const DDL = [
  `CREATE TABLE IF NOT EXISTS zc_meta (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS zc_documents (
     library_id INTEGER NOT NULL,
     item_key TEXT NOT NULL,
     source_revision TEXT NOT NULL,
     title TEXT NOT NULL,
     metadata TEXT NOT NULL,
     text TEXT NOT NULL,
     char_count INTEGER NOT NULL,
     hash TEXT NOT NULL,
     frozen_at INTEGER NOT NULL,
     PRIMARY KEY (library_id, item_key)
   )`,
  `CREATE TABLE IF NOT EXISTS zc_conversations (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     library_id INTEGER NOT NULL,
     item_key TEXT NOT NULL,
     archived INTEGER NOT NULL DEFAULT 0,
     prefix_hash TEXT,
     created_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS zc_conversations_item
     ON zc_conversations (library_id, item_key, archived, id)`,
  `CREATE TABLE IF NOT EXISTS zc_messages (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     conversation_id INTEGER NOT NULL,
     seq INTEGER NOT NULL,
     role TEXT NOT NULL,
     wire_content TEXT NOT NULL,
     display_content TEXT NOT NULL,
     display_id TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     UNIQUE (conversation_id, seq)
   )`,
  `CREATE TABLE IF NOT EXISTS zc_asides (
     id TEXT PRIMARY KEY,
     conversation_id INTEGER NOT NULL,
     source_message_id TEXT NOT NULL,
     quote TEXT NOT NULL,
     from_selection INTEGER NOT NULL DEFAULT 1,
     fork_seq INTEGER NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS zc_aside_messages (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     aside_id TEXT NOT NULL,
     seq INTEGER NOT NULL,
     role TEXT NOT NULL,
     wire_content TEXT NOT NULL,
     display_content TEXT NOT NULL,
     display_id TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     UNIQUE (aside_id, seq)
   )`,
];

export type StoredDoc = {
  libraryID: number;
  itemKey: string;
  revision: string;
  title: string;
  metadata: string;
  text: string;
  charCount: number;
  hash: string;
};

export type StoredTurn = {
  seq: number;
  role: "user" | "assistant";
  wireContent: string;
  displayContent: string;
  displayId: string;
};

export type StoredAsideRow = {
  id: string;
  sourceMessageId: string;
  quote: string;
  fromSelection: boolean;
  forkSeq: number;
  messages: StoredTurn[];
};

let conn: _ZoteroTypes.DB | null = null;
let ready: Promise<_ZoteroTypes.DB | null> | null = null;

function sqlitePath(): string {
  const dir = String(Zotero.DataDirectory.dir).replace(/[\\/]+$/, "");
  const sep = Zotero.isWin ? "\\" : "/";
  return `${dir}${sep}zoterochat.sqlite`;
}

async function open(): Promise<_ZoteroTypes.DB | null> {
  try {
    const db = new Zotero.DBConnection(sqlitePath());
    await db.queryAsync("PRAGMA foreign_keys=ON");
    for (const stmt of DDL) {
      await db.queryAsync(stmt);
    }
    const ver = await db.valueQueryAsync<string>(
      "SELECT value FROM zc_meta WHERE key = 'schema'",
    );
    if (ver === false) {
      await db.queryAsync(
        "INSERT INTO zc_meta (key, value) VALUES ('schema', ?)",
        [String(SCHEMA_VERSION)],
      );
    }
    ztoolkit.log("sqlite ready", db.path);
    return db;
  } catch (err) {
    ztoolkit.log("sqlite open failed", String(err));
    return null;
  }
}

export async function getDB(): Promise<_ZoteroTypes.DB | null> {
  ready ??= open().then((db) => {
    conn = db;
    return db;
  });
  return ready;
}

export async function closeDB(): Promise<void> {
  const db = conn;
  conn = null;
  ready = null;
  if (!db) return;
  try {
    await db.closeDatabase(true);
  } catch (err) {
    ztoolkit.log("sqlite close failed", String(err));
  }
}

export async function loadDocument(
  libraryID: number,
  itemKey: string,
): Promise<StoredDoc | null> {
  const db = await getDB();
  if (!db) return null;
  const row = (await db.rowQueryAsync(
    `SELECT library_id, item_key, source_revision, title, metadata, text,
            char_count, hash
       FROM zc_documents
      WHERE library_id = ? AND item_key = ?`,
    [libraryID, itemKey],
  )) as
    | {
        library_id: number;
        item_key: string;
        source_revision: string;
        title: string;
        metadata: string;
        text: string;
        char_count: number;
        hash: string;
      }
    | false;
  if (!row) return null;
  return {
    libraryID: row.library_id,
    itemKey: row.item_key,
    revision: row.source_revision,
    title: row.title,
    metadata: row.metadata,
    text: row.text,
    charCount: row.char_count,
    hash: row.hash,
  };
}

export async function saveDocument(doc: StoredDoc): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.queryAsync(
    `INSERT INTO zc_documents
       (library_id, item_key, source_revision, title, metadata, text,
        char_count, hash, frozen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (library_id, item_key) DO UPDATE SET
       source_revision = excluded.source_revision,
       title = excluded.title,
       metadata = excluded.metadata,
       text = excluded.text,
       char_count = excluded.char_count,
       hash = excluded.hash,
       frozen_at = excluded.frozen_at`,
    [
      doc.libraryID,
      doc.itemKey,
      doc.revision,
      doc.title,
      doc.metadata,
      doc.text,
      doc.charCount,
      doc.hash,
      Date.now(),
    ],
  );
}

export async function loadActiveConversation(
  libraryID: number,
  itemKey: string,
): Promise<{ id: number; createdAt: number } | null> {
  const db = await getDB();
  if (!db) return null;
  const row = (await db.rowQueryAsync(
    `SELECT id, created_at FROM zc_conversations
      WHERE library_id = ? AND item_key = ? AND archived = 0
      ORDER BY id DESC LIMIT 1`,
    [libraryID, itemKey],
  )) as { id: number; created_at: number } | false;
  if (!row) return null;
  return { id: row.id, createdAt: row.created_at };
}

export async function insertConversation(
  libraryID: number,
  itemKey: string,
): Promise<number | null> {
  const db = await getDB();
  if (!db) return null;
  await db.queryAsync(
    `INSERT INTO zc_conversations (library_id, item_key, archived, created_at)
     VALUES (?, ?, 0, ?)`,
    [libraryID, itemKey, Date.now()],
  );
  const id = await db.valueQueryAsync<number>("SELECT last_insert_rowid()");
  return typeof id === "number" ? id : null;
}

export async function archiveConversation(id: number): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.queryAsync("UPDATE zc_conversations SET archived = 1 WHERE id = ?", [
    id,
  ]);
}

export async function loadTurns(conversationId: number): Promise<StoredTurn[]> {
  const db = await getDB();
  if (!db) return [];
  const rows =
    (await db.queryAsync(
      `SELECT seq, role, wire_content, display_content, display_id
         FROM zc_messages
        WHERE conversation_id = ?
        ORDER BY seq ASC`,
      [conversationId],
    )) ?? [];
  return rows.map((row) => ({
    seq: Number(row.seq),
    role: row.role === "assistant" ? "assistant" : "user",
    wireContent: String(row.wire_content),
    displayContent: String(row.display_content),
    displayId: String(row.display_id),
  }));
}

export async function appendTurn(
  conversationId: number,
  turn: Omit<StoredTurn, "seq">,
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const last = await db.valueQueryAsync<number>(
    "SELECT COALESCE(MAX(seq), -1) FROM zc_messages WHERE conversation_id = ?",
    [conversationId],
  );
  const seq = (typeof last === "number" ? last : -1) + 1;
  await db.queryAsync(
    `INSERT INTO zc_messages
       (conversation_id, seq, role, wire_content, display_content, display_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      conversationId,
      seq,
      turn.role,
      turn.wireContent,
      turn.displayContent,
      turn.displayId,
      Date.now(),
    ],
  );
}

export async function insertAside(row: {
  id: string;
  conversationId: number;
  sourceMessageId: string;
  quote: string;
  fromSelection: boolean;
  forkSeq: number;
}): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.queryAsync(
    `INSERT OR IGNORE INTO zc_asides
       (id, conversation_id, source_message_id, quote, from_selection, fork_seq, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.conversationId,
      row.sourceMessageId,
      row.quote,
      row.fromSelection ? 1 : 0,
      row.forkSeq,
      Date.now(),
    ],
  );
}

export async function loadAsides(
  conversationId: number,
): Promise<StoredAsideRow[]> {
  const db = await getDB();
  if (!db) return [];
  const heads =
    (await db.queryAsync(
      `SELECT id, source_message_id, quote, from_selection, fork_seq
         FROM zc_asides
        WHERE conversation_id = ?
        ORDER BY created_at ASC`,
      [conversationId],
    )) ?? [];
  const out: StoredAsideRow[] = [];
  for (const head of heads) {
    const id = String(head.id);
    const msgs =
      (await db.queryAsync(
        `SELECT seq, role, wire_content, display_content, display_id
           FROM zc_aside_messages
          WHERE aside_id = ?
          ORDER BY seq ASC`,
        [id],
      )) ?? [];
    out.push({
      id,
      sourceMessageId: String(head.source_message_id),
      quote: String(head.quote),
      fromSelection: Number(head.from_selection) === 1,
      forkSeq: Number(head.fork_seq),
      messages: msgs.map((row) => ({
        seq: Number(row.seq),
        role: row.role === "assistant" ? "assistant" : "user",
        wireContent: String(row.wire_content),
        displayContent: String(row.display_content),
        displayId: String(row.display_id),
      })),
    });
  }
  return out;
}

export async function appendAsideTurn(
  asideId: string,
  turn: Omit<StoredTurn, "seq">,
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const last = await db.valueQueryAsync<number>(
    "SELECT COALESCE(MAX(seq), -1) FROM zc_aside_messages WHERE aside_id = ?",
    [asideId],
  );
  const seq = (typeof last === "number" ? last : -1) + 1;
  await db.queryAsync(
    `INSERT INTO zc_aside_messages
       (aside_id, seq, role, wire_content, display_content, display_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      asideId,
      seq,
      turn.role,
      turn.wireContent,
      turn.displayContent,
      turn.displayId,
      Date.now(),
    ],
  );
}
