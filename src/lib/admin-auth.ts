import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Parse the comma-separated ADMIN_USER_IDS env var into a trimmed allow-list.
// Pure: the raw string is a parameter — no env read here. Missing/empty/whitespace
// input yields [] so the owner gate fails closed (RESEARCH Pitfall 4).
export function parseAdminUserIds(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Fail-closed owner gate for every /admin surface (ADMIN-01). Returns the
// authenticated owner uid, or calls notFound() for every deny path so a
// non-owner cannot distinguish "route absent" from "forbidden" (Pitfall 4).
export async function requireOwner(): Promise<string> {
  const allow = parseAdminUserIds(process.env.ADMIN_USER_IDS);
  if (allow.length === 0) notFound(); // empty/misconfigured list → nobody is admin

  // Cookie-bound session client — identity MUST come from the session, never
  // createAdminClient(). getUser() revalidates against the auth server; do not
  // use the cookie-only session decoder, which is spoofable (Pitfall 5).
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (error || !uid || !allow.includes(uid)) notFound();

  return uid;
}
