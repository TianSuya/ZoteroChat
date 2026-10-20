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

function errorText(err: unknown): string {
  const status = (err as { status?: unknown })?.status;
  const message = String((err as Error)?.message ?? err);
  return typeof status === "number" ? `${message} (HTTP ${status})` : message;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function absoluteUrl(href: string, base: string): string | null {
  try {
    const url = new URL(decodeHtml(href), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Find the PDF target on a publisher landing page.
 *
 * DOI links usually land on an HTML page, not a PDF. Prefer the standard
 * `citation_pdf_url` meta tag, then a PDF link tag, then the first plausible
 * `.pdf` anchor. Exported for the unit test.
 */
export function findPdfLinkFromHtml(
  html: string,
  baseUrl: string,
): string | null {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    if (!/name=["']citation_pdf_url["']/i.test(tag)) continue;
    const content = tag.match(/content=["']([^"']+)["']/i)?.[1];
    if (!content) continue;
    const url = absoluteUrl(content, baseUrl);
    if (url && isSafeHttpUrl(url)) return url;
  }

  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    if (!/type=["']application\/pdf["']/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const url = absoluteUrl(href, baseUrl);
    if (url && isSafeHttpUrl(url)) return url;
  }

  const anchors = html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi);
  for (const match of anchors) {
    const href = match[1];
    if (!href || !(/\.pdf(?:[?#]|$)/i.test(href) || /\/pdf\//i.test(href)))
      continue;
    const url = absoluteUrl(href, baseUrl);
    if (url && isSafeHttpUrl(url)) return url;
  }

  return null;
}

/**
 * Fallback download path using the main window's fetch.
 *
 * Zotero's HTTP downloader rejects some bot-guarded publishers and doesn't
 * always expose why. Fetch gives us status, content-type, cookies, and the
 * bytes directly, so we can at least distinguish a real PDF from an HTML
 * challenge page. If the URL is a landing page, follow its PDF link once.
 */
async function downloadWithFetch(
  fetchImpl: typeof fetch,
  url: string,
  path: string,
  referrer?: string,
  depth = 0,
): Promise<void> {
  const res = await fetchImpl(url, {
    redirect: "follow",
    credentials: "include",
    headers: {
      Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
    },
    ...(referrer ? { referrer } : {}),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_PDF_BYTES) {
    throw new Error("Downloaded PDF is larger than 80 MB.");
  }

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml")
  ) {
    const html = await res.text();
    const pdf = findPdfLinkFromHtml(html, res.url || url);
    if (pdf && pdf !== url && depth < 2) {
      return downloadWithFetch(fetchImpl, pdf, path, url, depth + 1);
    }
    throw new Error("Response is HTML, not a PDF.");
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error("Downloaded PDF is larger than 80 MB.");
  }
  const headText = new TextDecoder().decode(bytes.slice(0, 512));
  if (headText.trimStart().startsWith("<")) {
    if (depth < 2) {
      const pdf = findPdfLinkFromHtml(
        new TextDecoder().decode(bytes),
        res.url || url,
      );
      if (pdf && pdf !== url) {
        return downloadWithFetch(fetchImpl, pdf, path, url, depth + 1);
      }
    }
    throw new Error("Response is HTML, not a PDF.");
  }
  if (!headText.startsWith("%PDF-")) {
    throw new Error(
      `Response is not a PDF (content-type: ${contentType || "unknown"})`,
    );
  }
  await IOUtils.write(path, bytes);
}

async function downloadPdf(
  url: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  const target = resolvePdfUrl(url);
  if (!isSafeHttpUrl(target)) {
    throw new Error("Refusing to download from a non-public URL.");
  }

  const dir = Zotero.getTempDirectory().path;
  const path = PathUtils.join(dir, `zoterochat-${Date.now()}.pdf`);
  const referrer = url.trim() !== target ? url.trim() : undefined;
  let zoteroError: string | null = null;

  // Zotero's downloader handles cookies, redirects, and some bot-guarded
  // pages. It returns undefined on success (not a boolean), so success is
  // judged by the file on disk, never by the return value alone.
  try {
    const options = {} as NonNullable<
      Parameters<typeof Zotero.Attachments.downloadFile>[2]
    >;
    if (referrer) options.referrer = referrer;
    (options as { enforceFileType?: boolean }).enforceFileType = true;
    const result = await Zotero.Attachments.downloadFile(target, path, options);
    if (result === false) throw new Error("Zotero downloader returned false.");
    if (!(await IOUtils.exists(path))) {
      throw new Error("Zotero downloader wrote no file.");
    }
  } catch (err) {
    zoteroError = errorText(err);
    ztoolkit.log("Zotero download failed", target, zoteroError);
    await IOUtils.remove(path).catch(() => undefined);
  }

  if (!(await IOUtils.exists(path))) {
    try {
      await downloadWithFetch(fetchImpl, target, path, referrer);
    } catch (err) {
      const fetchError = errorText(err);
      ztoolkit.log("fetch download failed", target, fetchError);
      await IOUtils.remove(path).catch(() => undefined);
      throw new Error(
        `Download failed. Zotero: ${zoteroError ?? "unknown"}; fetch: ${fetchError}`,
        { cause: err },
      );
    }
  }

  try {
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

  const path = await downloadPdf(req.url, ctx.fetch);
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
