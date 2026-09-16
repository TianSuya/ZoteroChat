declare const _globalThis: {
  [key: string]: unknown;
  Zotero: _ZoteroTypes.Zotero;
  addon: import("../src/addon").default;
};

declare const ztoolkit: ReturnType<
  typeof import("../src/utils/ztoolkit").createZToolkit
>;
declare const addon: import("../src/addon").default;

/** Injected by `bootstrap.js` into the plugin sandbox. */
declare const rootURI: string;

declare const __env__: "development" | "production";
