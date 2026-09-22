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
  askAside: string;
  asideTitle: string;
  asideBack: string;
  asidePlaceholder: string;
  asideQuoteLabel: string;
  asideEmpty: string;
  translatePending: string;
  translateCopy: string;
  translateCopied: string;
  translateNeedKey: string;
  translateFailed: string;
  translateFontSmaller: string;
  translateFontLarger: string;
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
    askAside: "针对选段提问",
    asideTitle: "针对这段",
    asideBack: "正文",
    asidePlaceholder: "针对这段提问…",
    asideQuoteLabel: "来自主对话",
    asideEmpty: "问这段里不懂的地方。",
    translatePending: "翻译中…",
    translateCopy: "复制译文",
    translateCopied: "已复制",
    translateNeedKey: "请在设置中填写该翻译引擎的 API key",
    translateFailed: "翻译失败",
    translateFontSmaller: "缩小译文",
    translateFontLarger: "放大译文",
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
    askAside: "針對選段提問",
    asideTitle: "針對這段",
    asideBack: "正文",
    asidePlaceholder: "針對這段提問…",
    asideQuoteLabel: "來自主對話",
    asideEmpty: "問這段裡不懂的地方。",
    translatePending: "翻譯中…",
    translateCopy: "複製譯文",
    translateCopied: "已複製",
    translateNeedKey: "請在設定中填寫該翻譯引擎的 API key",
    translateFailed: "翻譯失敗",
    translateFontSmaller: "縮小譯文",
    translateFontLarger: "放大譯文",
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
    askAside: "Ask about selection",
    asideTitle: "About this passage",
    asideBack: "Main thread",
    asidePlaceholder: "Ask about this passage…",
    asideQuoteLabel: "From the main conversation",
    asideEmpty: "Ask about anything unclear in this passage.",
    translatePending: "Translating…",
    translateCopy: "Copy translation",
    translateCopied: "Copied",
    translateNeedKey: "Add this engine’s API key in Settings",
    translateFailed: "Translation failed",
    translateFontSmaller: "Smaller translation text",
    translateFontLarger: "Larger translation text",
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
    askAside: "この箇所を質問",
    asideTitle: "この箇所について",
    asideBack: "本文",
    asidePlaceholder: "この箇所について聞く…",
    asideQuoteLabel: "本会話より",
    asideEmpty: "この箇所で分からないことを聞いてください。",
    translatePending: "翻訳中…",
    translateCopy: "訳文をコピー",
    translateCopied: "コピーしました",
    translateNeedKey: "設定でこのエンジンの API key を入力してください",
    translateFailed: "翻訳に失敗しました",
    translateFontSmaller: "訳文を小さく",
    translateFontLarger: "訳文を大きく",
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
    askAside: "선택한 구절에 질문",
    asideTitle: "이 구절에 대해",
    asideBack: "본문",
    asidePlaceholder: "이 구절에 대해 묻기…",
    asideQuoteLabel: "주 대화에서",
    asideEmpty: "이 구절에서 모르는 것을 물어보세요.",
    translatePending: "번역 중…",
    translateCopy: "번역 복사",
    translateCopied: "복사됨",
    translateNeedKey: "설정에서 이 엔진의 API key를 입력하세요",
    translateFailed: "번역 실패",
    translateFontSmaller: "번역 글자 작게",
    translateFontLarger: "번역 글자 크게",
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
    askAside: "Markierung befragen",
    asideTitle: "Zu dieser Stelle",
    asideBack: "Hauptverlauf",
    asidePlaceholder: "Zu dieser Stelle fragen…",
    asideQuoteLabel: "Aus dem Hauptgespräch",
    asideEmpty: "Frage, was an dieser Stelle unklar ist.",
    translatePending: "Übersetze…",
    translateCopy: "Übersetzung kopieren",
    translateCopied: "Kopiert",
    translateNeedKey:
      "API-Schlüssel für diese Engine in den Einstellungen eintragen",
    translateFailed: "Übersetzung fehlgeschlagen",
    translateFontSmaller: "Übersetzungsschrift verkleinern",
    translateFontLarger: "Übersetzungsschrift vergrößern",
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
    askAside: "Interroger la sélection",
    asideTitle: "À propos de ce passage",
    asideBack: "Fil principal",
    asidePlaceholder: "Question sur ce passage…",
    asideQuoteLabel: "Conversation principale",
    asideEmpty: "Posez une question sur ce qui n'est pas clair ici.",
    translatePending: "Traduction…",
    translateCopy: "Copier la traduction",
    translateCopied: "Copié",
    translateNeedKey: "Renseignez la clé API de ce moteur dans les paramètres",
    translateFailed: "Échec de la traduction",
    translateFontSmaller: "Réduire le texte traduit",
    translateFontLarger: "Agrandir le texte traduit",
  },
};

export function panelCopy(lang: UiLanguage): PanelCopy {
  return COPY[lang];
}
