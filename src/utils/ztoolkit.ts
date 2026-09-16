import { BasicTool } from "zotero-plugin-toolkit";

import { config } from "../../package.json";

export function createZToolkit() {
  const tool = new BasicTool();
  // Read `config` directly: this runs inside the Addon constructor, before the
  // `addon` global exists.
  tool.basicOptions.log.prefix = `[${config.addonName}]`;
  tool.basicOptions.log.disableConsole = __env__ === "production";
  return tool;
}
