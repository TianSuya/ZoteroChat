import { BasicTool } from "zotero-plugin-toolkit";

import Addon from "./addon";
import { config } from "../package.json";

const basicTool = new BasicTool();

const ZoteroGlobal = basicTool.getGlobal("Zotero") as unknown as Record<
  string,
  unknown
>;

if (!ZoteroGlobal[config.addonInstance]) {
  _globalThis.addon = new Addon();
  defineGlobal("ztoolkit", () => _globalThis.addon.data.ztoolkit);

  ZoteroGlobal[config.addonInstance] = addon;
}

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => unknown): void;
function defineGlobal(name: string, getter?: () => unknown) {
  Object.defineProperty(_globalThis, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}
