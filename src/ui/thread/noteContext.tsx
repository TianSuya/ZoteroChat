import { createContext, useContext } from "react";

import type { BridgeNote } from "../../panel-app/bridge";

export type RectLike = {
  top: number;
  left: number;
  bottom: number;
  width: number;
  height: number;
};

export type NoteEditorRequest = {
  messageId: string;
  quote: string;
  note?: BridgeNote;
  rect?: RectLike;
};

export type NoteActions = {
  notesFor: (messageId: string) => BridgeNote[];
  openNew: (messageId: string, quote: string, rect?: RectLike) => void;
  openExisting: (note: BridgeNote, rect?: RectLike) => void;
};

const Ctx = createContext<NoteActions | null>(null);

export const NoteActionsProvider = Ctx.Provider;

export function useNoteActions(): NoteActions | null {
  return useContext(Ctx);
}
