import { createContext, useContext, type ReactNode } from "react";

import { panelCopy, type PanelCopy } from "../i18n/panelCopy";
import type { UiLanguage } from "../i18n/languages";

const Ctx = createContext<UiLanguage>("zh-CN");

export function UiLanguageProvider({
  language,
  children,
}: {
  language: UiLanguage;
  children: ReactNode;
}) {
  return <Ctx.Provider value={language}>{children}</Ctx.Provider>;
}

export function useUiLanguage(): UiLanguage {
  return useContext(Ctx);
}

export function usePanelCopy(): PanelCopy {
  return panelCopy(useUiLanguage());
}
