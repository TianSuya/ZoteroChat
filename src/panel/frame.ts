import { config } from "../../package.json";
import type { PanelBridge, PanelFrameElement } from "../panel-app/bridge";
import { fitToItemPane } from "./sizing";

const XHTML_NS = "http://www.w3.org/1999/xhtml";
const PANEL_URL = `chrome://${config.addonRef}/content/panel.xhtml`;

/**
 * Zotero variables the panel stylesheet reads.
 *
 * Only colour-valued variables belong here. Zotero's `--material-border-*`
 * are border *shorthands* ("1px solid rgba(...)"), which are useless as a
 * `border-color` — the panel derives its border from `--fill-quinary` instead.
 *
 * Custom properties do not cross a document boundary, so unlike the shadow-DOM
 * approach the host theme has to be copied in explicitly. Each name is also
 * given a fallback in `tailwind.css`, so a rename degrades to the static
 * palette rather than an unstyled panel.
 */
const THEME_VARS = [
  "--material-sidepane",
  "--material-mix-quarternary",
  "--fill-primary",
  "--fill-secondary",
  "--fill-tertiary",
  "--fill-quinary",
  "--color-accent",
] as const;

function readTheme(win: Window): PanelBridge["theme"] {
  const tokens: Record<string, string> = {};
  const root = win.document.documentElement;
  const styles = root ? win.getComputedStyle(root) : null;
  for (const name of THEME_VARS) {
    const value = styles?.getPropertyValue(name)?.trim();
    if (value) tokens[name] = value;
  }
  return {
    mode: win.matchMedia("(prefers-color-scheme: dark)")?.matches
      ? "dark"
      : "light",
    tokens,
  };
}

export interface PanelFrame {
  /** The element to insert into the section body (wraps the iframe). */
  element: HTMLElement;
  /** Called after the element is in the DOM, so it can measure the pane. */
  attached: () => void;
  destroy: () => void;
}

/**
 * Creates the panel iframe and hands it a bridge once it has loaded.
 *
 * The frame is never reparented: moving an iframe in the DOM reloads its
 * document, which would drop React state mid-stream. `register.tsx` therefore
 * creates one frame per item pane body and lets the store own anything worth
 * keeping.
 */
export function createPanelFrame(
  doc: Document,
  bridge: Omit<PanelBridge, "theme" | "onThemeChange">,
): PanelFrame {
  const win = doc.defaultView!;

  // `fitToItemPane` owns the height; the wrapper just provides a flex column
  // for the frame to fill.
  const wrapper = doc.createElementNS(XHTML_NS, "div") as HTMLDivElement;
  wrapper.style.cssText = "overflow:hidden;display:flex;flex-direction:column;";

  const frame = doc.createElementNS(XHTML_NS, "iframe") as HTMLIFrameElement;
  frame.setAttribute("src", PANEL_URL);
  frame.setAttribute("transparent", "true");
  frame.style.cssText =
    "flex:1;width:100%;min-height:0;border:0;display:block;background:transparent;";
  wrapper.append(frame);

  const themeListeners = new Set<(theme: PanelBridge["theme"]) => void>();
  const media = win.matchMedia("(prefers-color-scheme: dark)");
  const pushTheme = () => {
    const theme = readTheme(win);
    for (const listener of themeListeners) listener(theme);
  };
  media?.addEventListener("change", pushTheme);

  const mount = () => {
    const frameWin = frame.contentWindow as any;
    if (!frameWin?.__zcMount) {
      ztoolkit.log("panel frame ready without __zcMount");
      return;
    }
    frameWin.__zcMount({
      ...bridge,
      theme: readTheme(win),
      onThemeChange: (listener: (theme: PanelBridge["theme"]) => void) => {
        themeListeners.add(listener);
        return () => themeListeners.delete(listener);
      },
    });
  };

  // Attached before insertion, so the panel can never signal before we listen.
  (frame as HTMLIFrameElement & PanelFrameElement).__zcOnReady = mount;

  let sizing: { dispose: () => void } | undefined;

  return {
    element: wrapper,
    // Measuring only works once the wrapper is in the pane, so the caller
    // tells us when that has happened.
    attached: () => {
      sizing = fitToItemPane(wrapper);
    },
    destroy: () => {
      sizing?.dispose();
      media?.removeEventListener("change", pushTheme);
      themeListeners.clear();
      try {
        (frame.contentWindow as any)?.__zcUnmount?.();
      } catch {
        // The frame may already be torn down; nothing to clean up then.
      }
      wrapper.remove();
    },
  };
}
