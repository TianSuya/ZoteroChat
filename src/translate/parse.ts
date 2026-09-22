function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseGoogleGtx(data: unknown): string {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return "";
  const chunks: string[] = [];
  for (const row of data[0]) {
    if (Array.isArray(row) && typeof row[0] === "string") chunks.push(row[0]);
  }
  return chunks.join("").trim();
}

export function parseDeepl(data: unknown): string {
  const rec = asRecord(data);
  const list = rec?.translations;
  if (!Array.isArray(list)) return "";
  return list
    .map((row) => asRecord(row)?.text)
    .filter((t): t is string => typeof t === "string")
    .join("")
    .trim();
}

export function parseGoogleCloud(data: unknown): string {
  const rec = asRecord(data);
  const inner = asRecord(rec?.data);
  const list = inner?.translations;
  if (!Array.isArray(list)) return "";
  const first = asRecord(list[0]);
  return typeof first?.translatedText === "string"
    ? first.translatedText.trim()
    : "";
}

export function parseAzure(data: unknown): string {
  if (!Array.isArray(data)) return "";
  const first = asRecord(data[0]);
  const list = first?.translations;
  if (!Array.isArray(list)) return "";
  const piece = asRecord(list[0]);
  return typeof piece?.text === "string" ? piece.text.trim() : "";
}

export function parseChatCompletion(data: unknown): string {
  const rec = asRecord(data);
  const choices = rec?.choices;
  if (!Array.isArray(choices)) return "";
  const msg = asRecord(asRecord(choices[0])?.message);
  return typeof msg?.content === "string" ? msg.content.trim() : "";
}
