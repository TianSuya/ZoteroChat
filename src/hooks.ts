import { seedDevLibrary } from "./dev/seed";
import { registerPanelSection, unregisterPanelSection } from "./panel/register";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  registerPanelSection();

  addon.data.initialized = true;
  ztoolkit.log("startup complete");

  await seedDevLibrary();
}

async function onMainWindowLoad(_win: Window) {
  // The item pane section re-renders per window on its own; nothing to do yet.
}

async function onMainWindowUnload(_win: Window) {
  // Window-scoped teardown lands here once the panel mounts React roots.
}

function onShutdown() {
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
