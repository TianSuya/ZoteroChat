import { config } from "../../package.json";
import { clearSecretCache, testConnection } from "../llm/session";
import { seedApiKeyFromDevFile } from "../llm/secrets";

export async function registerPreferencePane() {
  await seedApiKeyFromDevFile();

  const id = await Zotero.PreferencePanes.register({
    pluginID: config.addonID,
    src: rootURI + "content/preferences.xhtml",
    scripts: [rootURI + "content/scripts/preferences.js"],
    stylesheets: [rootURI + "content/preferences.css"],
    image: rootURI + "content/icons/icon-48.png",
    label: config.addonName,
  });
  addon.data.registry.prefsID = id;
  addon.data.api = {
    testConnection,
    clearSecretCache,
    openPreferences,
  };
  ztoolkit.log("registered preferences pane", id);
}

export function openPreferences() {
  const id = addon.data.registry.prefsID;
  if (!id) return;
  Zotero.Utilities.Internal.openPreferences(id);
}
