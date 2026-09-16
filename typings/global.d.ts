declare const _globalThis: {
  [key: string]: unknown;
  Zotero: _ZoteroTypes.Zotero;
  ztoolkit: import("../src/utils/ztoolkit").createZToolkit extends () => infer R
    ? R
    : never;
  addon: import("../src/addon").default;
};

declare const ztoolkit: ReturnType<
  typeof import("../src/utils/ztoolkit").createZToolkit
>;
declare const addon: import("../src/addon").default;

/** Injected by `bootstrap.js` into the plugin sandbox. */
declare const rootURI: string;
