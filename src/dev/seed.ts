import { config } from "../../package.json";

const SEED_PREF = `${config.prefsPrefix}.devSeedPDF`;

async function waitForMainWindow(timeoutMS = 10_000): Promise<Window | null> {
  const deadline = Date.now() + timeoutMS;
  while (Date.now() < deadline) {
    const win = Zotero.getMainWindow() as any;
    if (win && win.Zotero_Tabs) return win as Window;
    await Zotero.Promise.delay(200);
  }
  return null;
}

/**
 * Development-only fixture.
 *
 * `npm start` runs against a throwaway profile and an empty library, so there
 * is nothing to open the reader on. This imports the PDF named by the
 * `devSeedPDF` pref and leaves a reader tab open on it.
 *
 * `__env__` is an esbuild define, so the whole module is dead code in a
 * production build and gets dropped.
 */
export async function seedDevLibrary() {
  if (__env__ !== "development") return;

  const path = Zotero.Prefs.get(SEED_PREF, true) as string | undefined;
  if (!path) return;

  try {
    const win = await waitForMainWindow();
    if (!win) {
      ztoolkit.log("dev seed: no main window, skipping", {
        windows: Zotero.getMainWindows?.().length,
      });
      return;
    }

    const libraryID = Zotero.Libraries.userLibraryID;
    const existing = await Zotero.Items.getAll(libraryID, true);
    let attachment = existing.find((item) => item.isPDFAttachment?.());

    if (!attachment) {
      if (!(await IOUtils.exists(path))) {
        ztoolkit.log(`dev seed: ${path} not found, skipping`);
        return;
      }
      attachment = await Zotero.Attachments.importFromFile({
        file: path,
        libraryID,
      });
      ztoolkit.log(`dev seed: imported ${path} as item ${attachment.id}`);
    }

    // A reload leaves the previous reader tab open; don't stack duplicates.
    const tabs = ((win as any).Zotero_Tabs?._tabs ?? []) as Array<{
      type?: string;
      data?: { itemID?: number };
    }>;
    const alreadyOpen = tabs.some(
      (tab) => tab.type === "reader" && tab.data?.itemID === attachment!.id,
    );

    if (!alreadyOpen) {
      await Zotero.Reader.open(attachment.id);
      ztoolkit.log(`dev seed: opened reader for item ${attachment.id}`);
      return;
    }

    // A plugin reload re-registers the section, but Zotero only picks up new
    // custom sections inside `itemDetails.render()`, which fires on item or
    // tab change. Nothing changed across a reload, so bounce the tab to force
    // the panel to mount again.
    const tabs2 = (win as any).Zotero_Tabs;
    const readerTab = tabs.find(
      (tab) => tab.type === "reader" && tab.data?.itemID === attachment!.id,
    ) as { id?: string } | undefined;
    if (readerTab?.id && tabs2?.select) {
      tabs2.select("zotero-pane");
      await Zotero.Promise.delay(120);
      tabs2.select(readerTab.id);
      ztoolkit.log(
        `dev seed: bounced reader tab ${readerTab.id} to force re-render`,
      );
    }
  } catch (err) {
    ztoolkit.log("dev seed failed", err);
  }
}
