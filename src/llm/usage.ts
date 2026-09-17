import type { UsageSnapshot } from "./types";

export function normalizeUsage(raw: unknown): UsageSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  const promptTokens = num(u.prompt_tokens);
  const completionTokens = num(u.completion_tokens);
  const details =
    u.prompt_tokens_details && typeof u.prompt_tokens_details === "object"
      ? (u.prompt_tokens_details as Record<string, unknown>)
      : null;
  const cacheHitTokens =
    num(u.prompt_cache_hit_tokens) || num(details?.cached_tokens);
  const cacheMissTokens =
    num(u.prompt_cache_miss_tokens) ||
    Math.max(0, promptTokens - cacheHitTokens);
  if (promptTokens === 0 && completionTokens === 0 && cacheHitTokens === 0) {
    return null;
  }
  return { promptTokens, completionTokens, cacheHitTokens, cacheMissTokens };
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function formatUsage(
  usage: UsageSnapshot | null,
  opts: { charCount?: number; prefixBreak?: boolean; paperError?: string },
): string {
  if (opts.paperError) return opts.paperError;
  if (opts.prefixBreak) return "Cache break · prefix changed";
  if (!usage) {
    if (opts.charCount) {
      return `Paper in context · ${formatCount(opts.charCount)} chars`;
    }
    return "Reading paper…";
  }
  const hit = usage.promptTokens
    ? Math.round((usage.cacheHitTokens / usage.promptTokens) * 100)
    : 0;
  return `Cache ${hit}% · ${formatCount(usage.promptTokens)} in · ${formatCount(usage.completionTokens)} out`;
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}
