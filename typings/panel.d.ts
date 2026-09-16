import type { PanelBridge } from "../src/panel-app/bridge";

declare global {
  interface Window {
    /** Installed by the panel bundle; the host calls it once the frame loads. */
    __zcMount?: (bridge: PanelBridge) => void;
    __zcUnmount?: () => void;
  }

  const __env__: "development" | "production";
}

export {};
