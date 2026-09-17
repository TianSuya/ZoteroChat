import type { UiLanguage } from "./languages";

export type PanelCopy = {
  welcomeTitle: string;
  welcomeHint: string;
  composerPlaceholder: string;
  composerPlaceholderSelection: string;
  slashEmpty: string;
  slashLabel: string;
  newConversation: string;
  settings: string;
  send: string;
  stop: string;
  copy: string;
  clearSelection: string;
  explainSelection: string;
  selectionLabel: string;
};

const COPY: Record<UiLanguage, PanelCopy> = {
  "zh-CN": {
    welcomeTitle: "问这篇论文",
    welcomeHint:
      "全文已在上下文中。在 PDF 里划词可针对段落提问，或选一个起点。",
    composerPlaceholder: "问点什么…（输入 / 唤起命令）",
    composerPlaceholderSelection: "针对这段提问…",
    slashEmpty: "没有匹配的命令",
    slashLabel: "斜杠命令",
    newConversation: "新对话",
    settings: "设置",
    send: "发送",
    stop: "停止",
    copy: "复制",
    clearSelection: "清除选区",
    explainSelection: "解释选区",
    selectionLabel: "选中内容",
  },
  "zh-TW": {
    welcomeTitle: "問這篇論文",
    welcomeHint:
      "全文已在上下文中。在 PDF 裡劃詞可針對段落提問，或選一個起點。",
    composerPlaceholder: "問點什麼…（輸入 / 喚起命令）",
    composerPlaceholderSelection: "針對這段提問…",
    slashEmpty: "沒有符合的命令",
    slashLabel: "斜線命令",
    newConversation: "新對話",
    settings: "設定",
    send: "傳送",
    stop: "停止",
    copy: "複製",
    clearSelection: "清除選區",
    explainSelection: "解釋選區",
    selectionLabel: "選中內容",
  },
  en: {
    welcomeTitle: "Ask about this paper",
    welcomeHint:
      "The full text is already in context. Select a passage in the PDF, or pick a starting point.",
    composerPlaceholder: "Ask anything… (/ for commands)",
    composerPlaceholderSelection: "Ask about this passage…",
    slashEmpty: "No matching command",
    slashLabel: "Slash commands",
    newConversation: "New conversation",
    settings: "Settings",
    send: "Send",
    stop: "Stop",
    copy: "Copy",
    clearSelection: "Clear selection",
    explainSelection: "Explain selection",
    selectionLabel: "Selected passage",
  },
  ja: {
    welcomeTitle: "この論文に聞く",
    welcomeHint:
      "全文はすでに文脈に入っています。PDF で箇所を選ぶか、下の起点から始めてください。",
    composerPlaceholder: "質問を入力…（/ でコマンド）",
    composerPlaceholderSelection: "この箇所について聞く…",
    slashEmpty: "一致するコマンドがありません",
    slashLabel: "スラッシュコマンド",
    newConversation: "新しい会話",
    settings: "設定",
    send: "送信",
    stop: "停止",
    copy: "コピー",
    clearSelection: "選択を解除",
    explainSelection: "選択を解説",
    selectionLabel: "選択箇所",
  },
  ko: {
    welcomeTitle: "이 논문에 묻기",
    welcomeHint:
      "전문이 이미 맥락에 들어 있습니다. PDF에서 구절을 고르거나 아래 시작점을 고르세요.",
    composerPlaceholder: "무엇이든 물어보세요… (/ 로 명령)",
    composerPlaceholderSelection: "이 구절에 대해 묻기…",
    slashEmpty: "일치하는 명령이 없습니다",
    slashLabel: "슬래시 명령",
    newConversation: "새 대화",
    settings: "설정",
    send: "보내기",
    stop: "중지",
    copy: "복사",
    clearSelection: "선택 지우기",
    explainSelection: "선택 설명",
    selectionLabel: "선택한 구절",
  },
  de: {
    welcomeTitle: "Diese Arbeit befragen",
    welcomeHint:
      "Der Volltext ist bereits im Kontext. Markiere eine Stelle im PDF oder wähle einen Einstieg.",
    composerPlaceholder: "Frage stellen… (/ für Befehle)",
    composerPlaceholderSelection: "Zu dieser Stelle fragen…",
    slashEmpty: "Kein passender Befehl",
    slashLabel: "Schrägstrich-Befehle",
    newConversation: "Neues Gespräch",
    settings: "Einstellungen",
    send: "Senden",
    stop: "Stopp",
    copy: "Kopieren",
    clearSelection: "Auswahl löschen",
    explainSelection: "Auswahl erklären",
    selectionLabel: "Markierte Stelle",
  },
  fr: {
    welcomeTitle: "Interroger cet article",
    welcomeHint:
      "Le texte intégral est déjà dans le contexte. Sélectionnez un passage dans le PDF, ou un point de départ.",
    composerPlaceholder: "Posez une question… (/ pour les commandes)",
    composerPlaceholderSelection: "Question sur ce passage…",
    slashEmpty: "Aucune commande correspondante",
    slashLabel: "Commandes slash",
    newConversation: "Nouvelle conversation",
    settings: "Réglages",
    send: "Envoyer",
    stop: "Arrêter",
    copy: "Copier",
    clearSelection: "Effacer la sélection",
    explainSelection: "Expliquer la sélection",
    selectionLabel: "Passage sélectionné",
  },
};

export function panelCopy(lang: UiLanguage): PanelCopy {
  return COPY[lang];
}
