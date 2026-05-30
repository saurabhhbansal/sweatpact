import { createClient } from "@supabase/supabase-js";

// Server-only. Uses the service-role key, bypasses RLS.
// Never import from a client component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
