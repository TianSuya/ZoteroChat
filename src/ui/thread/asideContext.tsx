import { createContext, useContext } from "react";

export type AsideMarker = {
  id: string;
  quote: string;
  fromSelection: boolean;
};

export type AsideActions = {
  onAsk: (
    sourceMessageId: string,
    quote: string,
    origin: "selection" | "message",
  ) => void;
  onOpen: (asideId: string) => void;
  markersFor: (sourceMessageId: string) => AsideMarker[];
};

const Ctx = createContext<AsideActions | null>(null);

export const AsideActionsProvider = Ctx.Provider;

export function useAsideActions(): AsideActions | null {
  return useContext(Ctx);
}

export function excerptQuote(text: string, max = 400): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max).trimEnd()}…`;
}
