import { config } from "../package.json";
import { createZToolkit } from "./utils/ztoolkit";
import hooks from "./hooks";

class Addon {
  public data: {
    config: typeof config;
    /** Set once `onStartup` has finished; the test harness waits on it. */
    initialized: boolean;
    alive: boolean;
    ztoolkit: ReturnType<typeof createZToolkit>;
    /** Registration IDs we need to hand back to Zotero on shutdown. */
    registry: {
      sectionID?: string | false;
    };
  };

  public hooks: typeof hooks;

  constructor() {
    this.data = {
      config,
      initialized: false,
      alive: true,
      ztoolkit: createZToolkit(),
      registry: {},
    };
    this.hooks = hooks;
  }
}

export default Addon;
