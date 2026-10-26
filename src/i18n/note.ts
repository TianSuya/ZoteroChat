import type { UiLanguage } from "./languages";
import { slashQuery } from "./commands";

export type NoteCommand = {
  id: "summarize" | "related" | "write";
  slash: string;
  label: string;
  hint: string;
  prompt: string;
};

export type NoteCopy = {
  badge: string;
  title: string;
  hint: string;
  placeholder: string;
};

const COPY: Record<"zh-CN" | "en", NoteCopy> = {
  "zh-CN": {
    badge: "Note",
    title: "把这条笔记变成研究台",
    hint: "我可以检索论文、读 PDF、把选中的论文入库，也可以直接把总结写进这条笔记。",
    placeholder: "比如：总结当前笔记，或找几篇相关论文并写进来…",
  },
  en: {
    badge: "Note",
    title: "Turn this note into a research desk",
    hint: "I can search papers, read PDFs, add selected papers to Zotero, and write a summary directly into this note.",
    placeholder:
      "e.g. summarize this note, or find related papers and write them in…",
  },
};

const COMMANDS: Record<"zh-CN" | "en", NoteCommand[]> = {
  "zh-CN": [
    {
      id: "summarize",
      slash: "summarize",
      label: "总结这条笔记",
      hint: "提炼结构，写回笔记",
      prompt:
        "请阅读当前笔记，提炼已有内容的结构和关键结论，然后用 edit_note 追加一个简洁的「小结」小节。不要重复已有段落，不要覆盖整条笔记。",
    },
    {
      id: "related",
      slash: "related",
      label: "找相关论文",
      hint: "检索、读 PDF、勾选入库",
      prompt:
        "根据当前笔记的主题，检索相关论文，先用 search_library 查我库里有什么，再用 present_papers 给我一张可勾选候选列表；先不要直接写入。",
    },
    {
      id: "write",
      slash: "write",
      label: "写进笔记",
      hint: "把要点补成结构化小节",
      prompt:
        "请把当前对话里已经确认的论文要点整理成一个结构化小节，用 edit_note 追加到笔记末尾。保留来源链接，不要编造。",
    },
  ],
  en: [
    {
      id: "summarize",
      slash: "summarize",
      label: "Summarize this note",
      hint: "Structure and write back",
      prompt:
        "Read the current note, extract its structure and key conclusions, then append a concise 'Summary' section with edit_note. Do not duplicate existing paragraphs and do not replace the whole note.",
    },
    {
      id: "related",
      slash: "related",
      label: "Find related papers",
      hint: "Search, read, select, add",
      prompt:
        "Based on this note's topic, search for related papers. First use search_library to check my library, then present a selectable candidate list with present_papers. Do not write yet.",
    },
    {
      id: "write",
      slash: "write",
      label: "Write into note",
      hint: "Add a structured section",
      prompt:
        "Organize the confirmed paper takeaways from this conversation into a structured section and append it with edit_note. Keep source links and do not invent claims.",
    },
  ],
};

function packFor(lang: UiLanguage): "zh-CN" | "en" {
  return lang === "zh-CN" || lang === "zh-TW" ? "zh-CN" : "en";
}

export function noteCopy(lang: UiLanguage): NoteCopy {
  return COPY[packFor(lang)];
}

export function noteCommands(lang: UiLanguage): NoteCommand[] {
  return COMMANDS[packFor(lang)];
}

export function matchingNoteCommands(
  query: string,
  lang: UiLanguage,
): NoteCommand[] {
  const all = noteCommands(lang);
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter(
    (c) =>
      c.slash.startsWith(q) ||
      c.label.toLowerCase().includes(q) ||
      c.hint.toLowerCase().includes(q),
  );
}

export { slashQuery };
