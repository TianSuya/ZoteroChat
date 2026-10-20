import type { PaperRequest, PaperResult, ToolContext } from "./types";

const MAX_PDF_BYTES = 80 * 1024 * 1024;
const MIN_PDF_BYTES = 1024;

/** Reject anything that is not a public http(s) URL. */
export function isSafeHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.href.length > 8192) return false;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost"))
    return false;
  if (host.endsWith(".local") || host.endsWith(".internal")) return false;
  // Reject IPv6 literals outright: private/link-local/loopback variants are
  // too easy to misclassify, and public paper hosts are DNS names.
  if (host.includes(":")) return false;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) {
    return false;
  }
  if (/^169\.254\./.test(host) || /^0\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  return true;
}

/** Turn common landing-page URLs into a direct PDF URL. */
export function resolvePdfUrl(raw: string): string {
  const url = new URL(raw.trim());
  const host = url.hostname.toLowerCase();
  if (host === "arxiv.org" || host === "www.arxiv.org") {
    if (url.pathname.startsWith("/abs/")) {
      const id = url.pathname.slice("/abs/".length).replace(/\/+$/, "");
      if (id) return `https://arxiv.org/pdf/${id}`;
    }
  }
  if (host === "openreview.net" || host === "www.openreview.net") {
    if (url.pathname === "/forum") {
      const id = url.searchParams.get("id");
      if (id) return `https://openreview.net/pdf?id=${encodeURIComponent(id)}`;
    }
  }
  return url.toString();
}

function normalizeDoi(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .toLowerCase();
}

function creatorsFromAuthors(authors: string[] | undefined): Array<{
  creatorType: "author";
  firstName?: string;
  lastName?: string;
  name?: string;
}> {
  if (!authors?.length) return [];
  return authors
    .map((raw) => raw.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((name) => {
      const comma = name.indexOf(",");
      if (comma > 0) {
        const lastName = name.slice(0, comma).trim();
        const firstName = name.slice(comma + 1).trim();
        if (lastName) {
          return { creatorType: "author" as const, firstName, lastName };
        }
      }
      const space = name.lastIndexOf(" ");
      if (space > 0) {
        return {
          creatorType: "author" as const,
          firstName: name.slice(0, space).trim(),
          lastName: name.slice(space + 1).trim(),
        };
      }
      return { creatorType: "author" as const, name };
    });
}

/** DOI lookup against the target library's top-level items. */
export async function findExistingByDoi(
  libraryID: number,
  doi: string | undefined,
): Promise<Zotero.Item | null> {
  const wanted = normalizeDoi(doi);
  if (!wanted) return null;
  const items = await Zotero.Items.getAll(libraryID, true);
  for (const item of items) {
    if (!item?.isRegularItem?.()) continue;
    if (normalizeDoi(String(item.getField("DOI") ?? "")) === wanted)
      return item;
  }
  return null;
}

async function downloadPdf(url: string): Promise<string> {
  const target = resolvePdfUrl(url);
  if (!isSafeHttpUrl(target)) {
    throw new Error("Refusing to download from a non-public URL.");
  }

  const dir = Zotero.getTempDirectory().path;
  const path = PathUtils.join(dir, `zoterochat-${Date.now()}.pdf`);
  try {
    const ok = await Zotero.Attachments.downloadFile(target, path);
    if (!ok) throw new Error("Download failed.");

    const info = await IOUtils.stat(path);
    const size = info.size ?? 0;
    if (size < MIN_PDF_BYTES) {
      throw new Error("Downloaded file is too small.");
    }
    if (size > MAX_PDF_BYTES) {
      throw new Error("Downloaded PDF is larger than 80 MB.");
    }

    const head = await Zotero.File.getBinaryContentsAsync(path, 5);
    if (!head.startsWith("%PDF-")) {
      throw new Error("Downloaded file is not a PDF.");
    }
    return path;
  } catch (err) {
    await IOUtils.remove(path).catch(() => undefined);
    throw err;
  }
}

/**
 * Download a PDF and create a regular item plus child attachment in the
 * current library. The caller asks the user for confirmation first.
 */
export async function addPaperToZotero(
  req: PaperRequest,
  ctx: ToolContext,
): Promise<PaperResult> {
  const title = req.title.trim();
  if (!ctx.allowPaperDownloads) return { status: "disabled", title };
  if (!title) throw new Error("Paper title is required.");
  if (!isSafeHttpUrl(req.url)) {
    throw new Error("Refusing a non-public or malformed paper URL.");
  }

  const existing = await findExistingByDoi(ctx.libraryID, req.doi);
  if (existing) {
    return {
      status: "duplicate",
      itemID: existing.id,
      title: String(existing.getField("title") ?? title),
    };
  }

  const path = await downloadPdf(req.url);
  let parent: Zotero.Item | null = null;

  try {
    parent = new Zotero.Item("journalArticle");
    parent.libraryID = ctx.libraryID;
    parent.setField("title", title);
    parent.setField("url", req.url.trim());
    if (req.doi?.trim()) parent.setField("DOI", req.doi.trim());
    if (req.year?.trim()) parent.setField("date", req.year.trim());
    if (req.abstract?.trim())
      parent.setField("abstractNote", req.abstract.trim());
    const creators = creatorsFromAuthors(req.authors);
    if (creators.length) parent.setCreators(creators);
    if (ctx.collectionIDs.length) parent.setCollections(ctx.collectionIDs);
    const saved = await parent.saveTx();
    if (!saved) throw new Error("Zotero could not save the new item.");

    const attachment = await Zotero.Attachments.importFromFile({
      file: path,
      libraryID: ctx.libraryID,
      parentItemID: parent.id,
      title: `${title} PDF`,
    });

    return {
      status: "added",
      itemID: parent.id,
      attachmentID: attachment.id,
      title,
    };
  } catch (err) {
    if (parent?.id) {
      await parent.eraseTx().catch(() => undefined);
    }
    throw err;
  } finally {
    await IOUtils.remove(path).catch(() => undefined);
  }
}
