import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time equality for secrets (webhook tokens, etc.). A plain `===`/`!==`
 * short-circuits on the first differing byte, leaking how much of a guess is
 * correct via response timing. The webhook secrets are fixed-length random
 * tokens, so the only unavoidable leak (different lengths) is harmless here.
 */
export function safeEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
