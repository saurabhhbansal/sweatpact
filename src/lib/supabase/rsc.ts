import "server-only";
import { cache } from "react";
import { createClient } from "./server";
import { createAdminClient } from "./admin";
import type { ProgressRow } from "@/lib/onboarding-progress";

// Per-request memoized Supabase access for Server Components. The (tabs)
// layout and the page it wraps render in the same request; without this each
// of them constructs its own client and makes its own auth.getUser() round
// trip to the Supabase auth server. cache() scopes to a single RSC render
// pass, so this must only be imported from Server Components — route handlers
// should keep using createClient() directly.
export const getSupabaseRSC = cache(() => createClient());

export const getAuthUser = cache(async () => {
  const { data } = await getSupabaseRSC().auth.getUser();
  return data.user;
});

// The viewer's own profile row, fetched once per request with the union of
// the columns the (tabs) layout and pages need — replaces the per-page
// profiles selects so layout + page share a single query.
export const getViewerProfile = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  // Read the viewer's own row through the service-role client: `email` (and the
  // other sensitive columns) are no longer SELECT-able by the authenticated
  // role after the profile-column lockdown (migration 0029). We're strictly
  // scoped to the authenticated user's own id, so this is safe.
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select(
      "id, username, name, email, gender, timezone, created_at, weekly_goal, rest_days, onboarding_complete, avatar_url, notify_unverified_checkin, notify_rest_day, notify_cycle_share"
    )
    .eq("id", user.id)
    .single();
  if (error) {
    console.error("[getViewerProfile] db error", error.message);
  }
  return data ?? null;
});

// The viewer's own onboarding_progress row, fetched once per request. Used by
// the (tabs) layout to hydrate TourProvider without a client-side refetch flash.
// Uses the service-role client to read columns post-0029 column lockdown
// (same justified scope as getViewerProfile above).
export const getOnboardingProgress = cache(async (): Promise<ProgressRow | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  // Admin client + strict .eq("user_id", user.id) — same justified scope as
  // getViewerProfile (post-0029 column lockdown). SECURITY-CRITICAL: never widen this filter.
  // The eq filter is the sole access-control boundary — the admin client bypasses RLS (T-03-IDOR).
  const { data, error } = await createAdminClient()
    .from("onboarding_progress")
    .select("mandatory_done, tour_version, last_step_id, completed_steps, dismissed, completed_at")
    .eq("user_id", user.id) // owner-scoped — SECURITY-CRITICAL: never widen this filter
    .maybeSingle();
  if (error) {
    console.error("[getOnboardingProgress] db error", error.message);
  }
  return data ?? null; // null → blank-slate handling in TourProvider (D-06)
});
