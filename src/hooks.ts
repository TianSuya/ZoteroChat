import { checkSizing } from "./dev/checkSizing";
import { seedDevLibrary } from "./dev/seed";
import { registerPanelSection, unregisterPanelSection } from "./panel/register";
import { registerPreferencePane } from "./prefs/register";
import {
  registerReaderSelection,
  unregisterReaderSelection,
} from "./reader/selection";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  await registerPreferencePane();
  registerPanelSection();
  registerReaderSelection();

  addon.data.initialized = true;
  ztoolkit.log("startup complete");

  await seedDevLibrary();
  await checkSizing();
}

async function onMainWindowLoad(_win: Window) {
  // The item pane section re-renders per window on its own; nothing to do yet.
}

async function onMainWindowUnload(_win: Window) {
  // Frames are torn down by the section's own `onDestroy`.
}

function onShutdown() {
  unregisterReaderSelection();
  unregisterPanelSection();

  addon.data.alive = false;
  addon.data.initialized = false;
  // @ts-expect-error - plugin instance is removed from the Zotero global
  delete Zotero[addon.data.config.addonInstance];
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
};
