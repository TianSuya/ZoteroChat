import { stableStringify } from "./stableStringify";
import type { ChatMessage } from "./types";

export function hashMessages(messages: ChatMessage[]): string {
  return fnv1a(stableStringify(messages));
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Verifies that each request only appends. Cache misses are silent at the
 * HTTP layer; this is how we notice we caused one.
 */
export class PrefixLedger {
  private lastFull: string | null = null;

  check(messages: ChatMessage[]): { ok: boolean; prefixHash: string } {
    const prefixHash = hashMessages(messages.slice(0, -1));
    const ok = this.lastFull === null || this.lastFull === prefixHash;
    return { ok, prefixHash };
  }

  commit(full: ChatMessage[]): void {
    this.lastFull = hashMessages(full);
  }

  reset(): void {
    this.lastFull = null;
  }
}
