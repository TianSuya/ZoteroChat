import { createRoot, type Root } from "react-dom/client";

import panelCss from "virtual:panel-css";

import { report } from "../utils/report";
import { App } from "./App";
import type { PanelBridge } from "./bridge";

/*
 * Entry point for the panel document.
 *
 * This runs inside an iframe with a real HTML document, which is the whole
 * reason the iframe exists: React, Radix and floating-ui all assume a normal
 * browsing context — `document.body`, live layout effects, an overflow
 * ancestor chain that terminates at <body>. Zotero's main window is a XUL
 * document with `document.body === null`, and no amount of shimming makes it
 * look like a page.
 */

let root: Root | null = null;

function installStyles() {
  const style = document.createElement("style");
  style.id = "zc-styles";
  style.textContent = panelCss;
  document.head.append(style);
}

/*
 * Detach the panel from the outer document's scroll ancestry.
 *
 * floating-ui walks overflow ancestors and, on reaching our <body>, follows
 * `window.frameElement` out into the parent document to keep tracking scroll.
 * That parent is Zotero's XUL window, where `document.body` is null, and the
 * walk crashes on `getComputedStyle(null)`.
 *
 * Nothing inside the panel needs the outer chain: the frame fills its section
 * and scrolls internally. Hiding `frameElement` from the panel's own window is
 * the smallest honest way to say so — it touches neither Zotero's document nor
 * floating-ui's source, and it is scoped to this one window.
 */
const frameElement = window.frameElement as
  (Element & { __zcOnReady?: () => void }) | null;

try {
  Object.defineProperty(window, "frameElement", {
    get: () => null,
    configurable: true,
  });
} catch (err) {
  report("could not detach frameElement", String(err));
}

window.__zcMount = (bridge: PanelBridge) => {
  if (!document.getElementById("zc-styles")) installStyles();

  const container = document.getElementById("zc-root");
  if (!container) throw new Error("panel.xhtml is missing #zc-root");

  container.className = "zc-root";
  root ??= createRoot(container);
  root.render(<App bridge={bridge} />);
};

window.__zcUnmount = () => {
  root?.unmount();
  root = null;
};

// Tell the host we are ready. See PanelFrameElement for why this is an
// explicit handshake rather than the frame's `load` event. Note this uses the
// captured reference: `window.frameElement` reads as null from here on.
frameElement?.__zcOnReady?.();
