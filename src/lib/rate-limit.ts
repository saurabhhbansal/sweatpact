import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fixed-window rate limit backed by the Postgres `check_rate_limit` function.
 * Returns true when the request is allowed. Fails OPEN: if the limiter itself
 * errors we don't lock out legitimate traffic — this is best-effort abuse
 * mitigation, not an authorization control. Works with either the admin or a
 * user client: `check_rate_limit` is SECURITY DEFINER and is the only writer to
 * the internal (deny-all RLS) rate_limits table, so callers never touch it
 * directly.
 */
export async function rateLimit(
  client: SupabaseClient,
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await client.rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) return true;
  return data === true;
}

/** Best-effort client IP from the proxy headers. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
