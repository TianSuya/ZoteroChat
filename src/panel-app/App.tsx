import { useEffect, useState } from "react";

import { RadixProbe } from "../dev/radixProbe";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { Thread } from "../ui/Thread";
import type { PanelBridge } from "./bridge";

export function App({ bridge }: { bridge: PanelBridge }) {
  const [theme, setTheme] = useState(bridge.theme);

  useEffect(() => bridge.onThemeChange?.(setTheme), [bridge]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.zcTheme = theme.mode;
    for (const [name, value] of Object.entries(theme.tokens)) {
      root.style.setProperty(name, value);
    }
  }, [theme]);

  return (
    <ErrorBoundary label="panel">
      <Thread paperTitle={bridge.paperTitle}>
        {bridge.showProbe ? <RadixProbe /> : null}
      </Thread>
    </ErrorBoundary>
  );
}
