import { config } from "../../package.json";

/**
 * Everything is derived from our own frame.
 *
 * Reader tabs get their own item pane inside the context pane, so a document
 * -wide `querySelector` can easily return the library's hidden instance and
 * measure the wrong thing entirely.
 */
function locate(win: any) {
  const doc = win.document as Document;
  const frame = doc.querySelector(
    `iframe[src^="chrome://${config.addonRef}/content/panel"]`,
  ) as HTMLIFrameElement | null;
  const wrapper = frame?.parentElement as HTMLElement | null;
  const section = frame?.closest(
    "item-pane-custom-section",
  ) as HTMLElement | null;
  const viewport = frame?.closest("#zotero-view-item") as HTMLElement | null;
  const details = frame?.closest("item-details") as any;
  return { frame, wrapper, section, viewport, details };
}

function describe(win: any) {
  const { wrapper, section, viewport } = locate(win);
  if (!viewport || !section || !wrapper) {
    return {
      missing: { viewport: !viewport, section: !section, wrapper: !wrapper },
    };
  }

  const vRect = viewport.getBoundingClientRect();
  const sRect = section.getBoundingClientRect();
  const wRect = wrapper.getBoundingClientRect();
  return {
    viewportH: Math.round(viewport.clientHeight),
    scrollH: Math.round(viewport.scrollHeight),
    scrollTop: Math.round(viewport.scrollTop),
    sectionTopVisible: Math.round(sRect.top - vRect.top),
    panelH: Math.round(wRect.height),
    /** 0 means the panel ends exactly at the pane's bottom edge. */
    gapBelow: Math.round(vRect.bottom - wRect.bottom),
  };
}

/**
 * Development-only check for the panel's auto-sizing.
 *
 * Clicking the section's sidenav button makes Zotero scroll it to the top of
 * the pane. The panel has to grow to match, or the composer ends up floating
 * in the middle — so verify both states rather than only the resting one.
 */
export async function checkSizing() {
  if (__env__ !== "development") return;

  try {
    const win = Zotero.getMainWindow() as any;
    await Zotero.Promise.delay(600);

    const { details, section } = locate(win);
    const paneID = section?.dataset.pane;
    if (!details?.scrollToPane || !paneID) {
      ztoolkit.log("sizing check: no item-details or paneID", {
        hasDetails: Boolean(details?.scrollToPane),
        paneID,
      });
      return;
    }

    // Start from a known state: Zotero keeps the pane's scroll position across
    // restarts, so without this the "at rest" reading is whatever the last run
    // left behind.
    locate(win).viewport?.scrollTo({ top: 0 });
    await Zotero.Promise.delay(200);
    ztoolkit.log("sizing check @rest", JSON.stringify(describe(win)));

    // Same thing the sidenav button does.
    await details.scrollToPane(paneID, "instant");
    await Zotero.Promise.delay(400);
    ztoolkit.log(
      "sizing check @scrolled-to-top",
      JSON.stringify(describe(win)),
    );
  } catch (err) {
    ztoolkit.log("sizing check failed", err);
  }
}
