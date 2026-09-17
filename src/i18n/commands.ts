import type { UiLanguage } from "./languages";

export type ChatCommand = {
  id: "summarize" | "explain" | "limitations" | "terms";
  slash: string;
  label: string;
  hint: string;
  prompt: string;
};

type Pack = Record<ChatCommand["id"], Omit<ChatCommand, "id" | "slash">>;

const PACKS: Record<UiLanguage, Pack> = {
  "zh-CN": {
    summarize: {
      label: "概括全文",
      hint: "问题、方法、结果、意义",
      prompt:
        "请用完整简体中文概括这篇论文，按这个顺序写清楚：\n1. 要解决什么问题、为什么值得做；\n2. 方法怎么做、关键步骤是什么；\n3. 得到了哪些主要结果；\n4. 这些结果为什么重要。\n严格依据正文。专有名词和公式可保留原文（如 Transformer、d_model），但不要把英文原句嵌进中文里，需要引用时先用中文转述。不要编造未出现的结论。",
    },
    explain: {
      label: "讲解方法",
      hint: "它怎么做、新在哪里",
      prompt:
        "请用完整简体中文、通俗但准确地讲解这篇论文的核心方法：它具体怎么做、相对已有工作新在哪里、依赖哪些假设。结合正文里的步骤、公式或实验设置。公式和符号可保留原文，但公式后必须用中文解释；不要整句粘贴英文原文。",
    },
    limitations: {
      label: "局限与问题",
      hint: "作者承认的，以及实验暗示的",
      prompt:
        "请用完整简体中文说明：这篇论文自己承认了哪些局限、失败情况或未解决问题？它的数据、设定或实验协议还暗示了哪些限制？请区分作者写明的保留意见，和你从实验设置做出的推断。不要整句粘贴英文，不要发明正文不支持的弱点。",
    },
    terms: {
      label: "关键术语",
      hint: "按本文用法来定义",
      prompt:
        "请用完整简体中文列出这篇论文中最关键的技术术语。对每个术语：先写中文名称（可在括号里保留英文原名），再用一两句话按本文用法解释。不要只丢下一个英文词，也不要用脱离本文的教科书定义敷衍。",
    },
  },
  "zh-TW": {
    summarize: {
      label: "概括全文",
      hint: "問題、方法、結果、意義",
      prompt:
        "請用完整繁體中文概括這篇論文，按這個順序寫清楚：\n1. 要解決什麼問題、為什麼值得做；\n2. 方法怎麼做、關鍵步驟是什麼；\n3. 得到了哪些主要結果；\n4. 這些結果為什麼重要。\n專有名詞和公式可保留原文，但不要把英文原句嵌進中文裡，需要引用時先用中文轉述。",
    },
    explain: {
      label: "講解方法",
      hint: "它怎麼做、新在哪裡",
      prompt:
        "請用完整繁體中文、通俗但準確地講解這篇論文的核心方法：它具體怎麼做、相對已有工作新在哪裡、依賴哪些假設。公式和符號可保留原文，但公式後必須用中文解釋；不要整句貼上英文原文。",
    },
    limitations: {
      label: "局限與問題",
      hint: "作者承認的，以及實驗暗示的",
      prompt:
        "請用完整繁體中文說明：這篇論文自己承認了哪些局限、失敗情況或未解決問題？它的資料、設定或實驗協議還暗示了哪些限制？請區分作者寫明的保留意見，和你從實驗設置做出的推斷。不要整句貼上英文原文。",
    },
    terms: {
      label: "關鍵術語",
      hint: "按本文用法來定義",
      prompt:
        "請用完整繁體中文列出這篇論文中最關鍵的技術術語。對每個術語：先寫中文名稱（可在括號裡保留英文原名），再用一兩句話按本文用法解釋。不要只丟下一個英文詞。",
    },
  },
  en: {
    summarize: {
      label: "Summarize",
      hint: "Problem, method, results, why it matters",
      prompt:
        "Summarize this paper in a few short paragraphs, in this order:\n1. the problem and why it is worth solving;\n2. how the method works, including the key steps;\n3. the main results;\n4. why those results matter.\nStick to claims the paper actually makes. Do not invent findings, and do not write a generic survey of the field.",
    },
    explain: {
      label: "Explain the method",
      hint: "How it works, and what is new",
      prompt:
        "Explain the core method of this paper in plain but precise English: how it works step by step, what is new relative to prior work, and which assumptions it relies on. Ground the explanation in the paper's procedures, equations, or experimental setup — not a one-line slogan.",
    },
    limitations: {
      label: "Limitations",
      hint: "Stated caveats vs. implied constraints",
      prompt:
        "What limitations, failure modes, or open questions does this paper itself acknowledge? What further constraints follow from its data, setting, or protocol? Clearly separate the authors' stated caveats from inferences. Do not invent weaknesses the text does not support.",
    },
    terms: {
      label: "Key terms",
      hint: "As used in this paper",
      prompt:
        "List the key technical terms in this paper. For each term, give a one- or two-sentence definition as it is used here, and if needed one clause on the role it plays. Do not substitute a generic textbook definition.",
    },
  },
  ja: {
    summarize: {
      label: "要約",
      hint: "課題・手法・結果・意義",
      prompt:
        "この論文を短い段落で要約してください。順序は次のとおりです。\n1. 解くべき問題と、それが重要な理由\n2. 手法の進め方と要点\n3. 主要な結果\n4. その結果がなぜ重要か\n本文の主張に厳密に従ってください。書かれていない結論を作らず、分野の一般論で済ませないでください。",
    },
    explain: {
      label: "手法の解説",
      hint: "どう行うか、何が新しいか",
      prompt:
        "この論文の中核手法を、正確で平易な日本語で説明してください。具体的な手順、既存研究と比べて新しい点、依拠する仮定を含めてください。スローガンではなく、本文の手続き・式・実験設定に即して書いてください。",
    },
    limitations: {
      label: "限界と課題",
      hint: "著者が認めたことと、実験が示唆すること",
      prompt:
        "この論文自身が認める限界、失敗しうる条件、未解決の問いは何ですか。データや実験プロトコルからさらに読み取れる制約はありますか。著者が明示した caveat と、あなたが推論した制約を分けて書いてください。本文が支えない弱点を作らないでください。",
    },
    terms: {
      label: "用語",
      hint: "本稿での使い方",
      prompt:
        "この論文の重要な術語を列挙してください。各術語について、本稿での意味を一文か二文で定義し、必要なら本文中の役割を一句添えてください。一般的な教科書定義で済ませないでください。",
    },
  },
  ko: {
    summarize: {
      label: "요약",
      hint: "문제, 방법, 결과, 의미",
      prompt:
        "이 논문을 짧은 문단으로 요약하세요. 순서는 다음과 같습니다.\n1. 풀려는 문제와 그 이유\n2. 방법이 실제로 하는 일과 핵심 단계\n3. 주요 결과\n4. 그 결과가 왜 중요한지\n본문의 주장에 엄격히 따르세요. 없는 결론을 만들지 말고, 분야 일반론으로 메우지 마세요.",
    },
    explain: {
      label: "방법 설명",
      hint: "어떻게 하며, 무엇이 새로운가",
      prompt:
        "이 논문의 핵심 방법을 정확하고 쉬운 한국어로 설명하세요. 구체적인 절차, 기존 연구 대비 새로운 점, 의존하는 가정을 포함하세요. 구호가 아니라 본문의 절차·수식·실험 설정에 근거하세요.",
    },
    limitations: {
      label: "한계와 과제",
      hint: "저자가 인정한 것과 실험이 암시하는 것",
      prompt:
        "이 논문이 스스로 인정하는 한계, 실패 조건, 미해결 질문은 무엇입니까? 데이터나 실험 프로토콜에서 더 읽히는 제약은 있습니까? 저자가 명시한 caveat와 추론을 구분하세요. 본문이 뒷받침하지 않는 약점을 만들지 마세요.",
    },
    terms: {
      label: "핵심 용어",
      hint: "이 논문에서의 쓰임",
      prompt:
        "이 논문의 핵심 기술 용어를 나열하세요. 각 용어를 이 논문에서 쓰인 의미로 한두 문장 정의하고, 필요하면 본문에서의 역할을 한 구절 보태세요. 일반적인 교과서 정의로 대체하지 마세요.",
    },
  },
  de: {
    summarize: {
      label: "Zusammenfassung",
      hint: "Problem, Methode, Ergebnisse, Bedeutung",
      prompt:
        "Fasse diese Arbeit in wenigen kurzen Absätzen zusammen, in dieser Reihenfolge:\n1. das Problem und warum es sich lohnt;\n2. wie die Methode vorgeht, inklusive der entscheidenden Schritte;\n3. die wichtigsten Ergebnisse;\n4. warum sie bedeutsam sind.\nHalte dich an Behauptungen, die der Text wirklich aufstellt. Erfinde keine Befunde und schreibe keine generische Feldbeschreibung.",
    },
    explain: {
      label: "Methode erklären",
      hint: "Ablauf und das Neue",
      prompt:
        "Erkläre die Kernmethode dieser Arbeit auf klarem, präzisem Deutsch: wie sie Schritt für Schritt funktioniert, was gegenüber Vorarbeiten neu ist, und auf welchen Annahmen sie beruht. Stütze dich auf Verfahren, Gleichungen oder das experimentelle Setup — nicht auf einen Slogan.",
    },
    limitations: {
      label: "Grenzen",
      hint: "Genannte Vorbehalte vs. implizite Grenzen",
      prompt:
        "Welche Grenzen, Fehlermodi oder offenen Fragen benennt die Arbeit selbst? Welche weiteren Einschränkungen folgen aus Daten, Setting oder Protokoll? Trenne ausdrücklich die Caveats der Autor:innen von deinen Schlussfolgerungen. Erfinde keine Schwächen, die der Text nicht trägt.",
    },
    terms: {
      label: "Fachbegriffe",
      hint: "So wie die Arbeit sie verwendet",
      prompt:
        "Liste die zentralen Fachbegriffe dieser Arbeit. Definiere jeden Begriff in ein bis zwei Sätzen so, wie er hier verwendet wird, und ergänze bei Bedarf seine Rolle im Text. Keine generischen Lehrbuchdefinitionen.",
    },
  },
  fr: {
    summarize: {
      label: "Résumé",
      hint: "Problème, méthode, résultats, enjeu",
      prompt:
        "Résume cet article en quelques courts paragraphes, dans cet ordre :\n1. le problème et pourquoi il vaut la peine ;\n2. comment la méthode procède, y compris les étapes clés ;\n3. les principaux résultats ;\n4. pourquoi ils importent.\nTiens-toi aux affirmations du texte. N'invente pas de résultats et n'écris pas un survol générique du domaine.",
    },
    explain: {
      label: "Expliquer la méthode",
      hint: "Comment ça marche, ce qui est nouveau",
      prompt:
        "Explique la méthode centrale de cet article en français clair et précis : le déroulement concret, ce qui est nouveau par rapport aux travaux antérieurs, et les hypothèses sur lesquelles elle repose. Appuie-toi sur les procédures, équations ou le dispositif expérimental — pas sur un slogan.",
    },
    limitations: {
      label: "Limites",
      hint: "Réserves des auteurs vs contraintes induites",
      prompt:
        "Quelles limites, défaillances ou questions ouvertes l'article reconnaît-il lui-même ? Quelles contraintes supplémentaires suivent de ses données, de son cadre ou de son protocole ? Distingue clairement les caveats des auteurs et tes inférences. N'invente pas de faiblesses que le texte ne soutient pas.",
    },
    terms: {
      label: "Termes clés",
      hint: "Au sens de cet article",
      prompt:
        "Liste les termes techniques centraux de cet article. Pour chacun, donne une définition d'une ou deux phrases telle qu'il est employé ici, et au besoin son rôle dans le texte. Pas de définition de manuel générique.",
    },
  },
};

const ORDER: ChatCommand["id"][] = [
  "summarize",
  "explain",
  "limitations",
  "terms",
];

export function commandsFor(lang: UiLanguage): ChatCommand[] {
  const pack = PACKS[lang];
  return ORDER.map((id) => ({
    id,
    slash: id,
    ...pack[id],
  }));
}

export function slashQuery(text: string): string | null {
  if (!text.startsWith("/")) return null;
  if (/[\s\n]/.test(text)) return null;
  return text.slice(1).toLowerCase();
}

const EXPLAIN_SELECTION: Record<UiLanguage, string> = {
  "zh-CN":
    "请解释当前选中的这段文字：它在说什么、在本文论证里起什么作用、有没有需要注意的术语或前提。用完整简体中文写。专有名词和公式可保留原文，不要整句粘贴英文。",
  "zh-TW":
    "請解釋當前選中的這段文字：它在說什麼、在本文論證裡起什麼作用、有沒有需要注意的術語或前提。用完整繁體中文寫。專有名詞和公式可保留原文，不要整句貼上英文。",
  en: "Explain the selected passage: what it says, the role it plays in the paper's argument, and any terms or assumptions worth flagging. Keep proper nouns and formulas in original form; do not paste English sentences if answering in another language.",
  ja: "選択箇所を説明してください。何を述べているか、本稿の議論での役割、注意すべき用語や前提。固有名詞と式は原文のままで構いません。英文をそのまま埋め込まないでください。",
  ko: "선택한 구절을 설명하세요. 무엇을 말하는지, 논문 논증에서의 역할, 짚어야 할 용어나 가정. 고유명사와 수식은 원문 그대로 두되 영어 문장을 그대로 넣지 마세요.",
  de: "Erkläre die markierte Stelle: was sie sagt, welche Rolle sie in der Argumentation spielt, und welche Begriffe oder Annahmen auffallen. Eigennamen und Formeln dürfen original bleiben; keine englischen Sätze einfügen.",
  fr: "Explique le passage sélectionné : ce qu'il dit, son rôle dans l'argument, les termes ou hypothèses à noter. Les noms propres et formules peuvent rester en original ; n'insère pas de phrases anglaises.",
};

export function explainSelectionPrompt(lang: UiLanguage): string {
  return EXPLAIN_SELECTION[lang];
}

export function matchingCommands(
  query: string,
  lang: UiLanguage,
): ChatCommand[] {
  const all = commandsFor(lang);
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter(
    (c) =>
      c.slash.startsWith(q) ||
      c.label.toLowerCase().includes(q) ||
      c.hint.toLowerCase().includes(q),
  );
}
