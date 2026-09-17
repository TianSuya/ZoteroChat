import { normalize } from "./normalize";

export type PaperRecord = {
  itemID: number;
  libraryID: number;
  attachmentKey: string;
  revision: string;
  title: string;
  metadata: string;
  text: string;
  hash: string;
  charCount: number;
};

function asItem(
  value: Zotero.Item | false | undefined | null,
): Zotero.Item | undefined {
  return value ? value : undefined;
}

function field(item: Zotero.Item, name: string): string {
  try {
    return String(item.getField(name as any) ?? "").trim();
  } catch {
    return "";
  }
}

function metadataBlock(item: Zotero.Item): { title: string; metadata: string } {
  const parent = asItem(
    item.parentID ? Zotero.Items.get(item.parentID) : undefined,
  );
  const src = parent ?? item;
  const title =
    field(src, "title") || item.attachmentFilename || `Item ${item.id}`;
  const creators = parent
    ? parent
        .getCreators()
        .map((c) => [c.firstName, c.lastName].filter(Boolean).join(" ").trim())
        .filter(Boolean)
        .join(", ")
    : "";
  const year = field(src, "year") || field(src, "date");
  const doi = field(src, "DOI");
  const abstractNote = field(src, "abstractNote");

  const lines = [`title: ${title}`];
  if (creators) lines.push(`authors: ${creators}`);
  if (year) lines.push(`year: ${year}`);
  if (doi) lines.push(`doi: ${doi}`);
  if (abstractNote) lines.push(`abstract: ${abstractNote}`);
  return { title, metadata: lines.join("\n") };
}

function revisionOf(item: Zotero.Item): string {
  const mtime = Number(item.attachmentModificationTime ?? 0);
  return `${item.libraryID}:${item.key}:${mtime}`;
}

function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Pulls full text through Zotero's PDF worker. Cached in-process by
 * sourceRevision so a file that has not changed is not extracted again.
 */
export async function extractPaper(itemID: number): Promise<PaperRecord> {
  const item = asItem(await Zotero.Items.getAsync(itemID));
  if (!item?.isPDFAttachment?.()) {
    throw new Error("Current item is not a PDF attachment.");
  }

  const { title, metadata } = metadataBlock(item);
  const worker = (Zotero as any).PDFWorker;
  if (!worker?.getFullText) {
    throw new Error("Zotero.PDFWorker.getFullText is unavailable.");
  }

  const result = await worker.getFullText(item.id);
  const raw = typeof result === "string" ? result : String(result?.text ?? "");
  const text = normalize(raw);
  if (!text) {
    throw new Error("PDF text extraction returned nothing.");
  }

  return {
    itemID: item.id,
    libraryID: item.libraryID,
    attachmentKey: item.key,
    revision: revisionOf(item),
    title,
    metadata,
    text,
    hash: hashText(text),
    charCount: text.length,
  };
}
