import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
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

// Cross-request cache helpers (unstable_cache) — these persist across requests
// until the per-user tag is invalidated by a mutation API route. The admin
// client is safe inside unstable_cache because it uses only env vars, never
// cookies() or headers(). Never wrap the RLS-bound RSC client (createClient())
// in unstable_cache — it calls cookies() which is request-scoped.
//
// The outer React.cache() wrapper is still essential: it deduplicates within
// a single render pass so layout + page share one call to the data cache.

const fetchViewerProfile = (userId: string) =>
  unstable_cache(
    async () => {
      // Read the viewer's own row through the service-role client: `email` (and
      // other sensitive columns) are no longer SELECT-able by the authenticated
      // role after the profile-column lockdown (migration 0029). Strictly scoped
      // to the authenticated user's own id — safe. SECURITY-CRITICAL: never widen.
      const { data, error } = await createAdminClient()
        .from("profiles")
        .select(
          "id, username, name, email, gender, timezone, created_at, weekly_goal, rest_days, onboarding_complete, avatar_url, notify_unverified_checkin, notify_rest_day, notify_cycle_share"
        )
        .eq("id", userId)
        .single();
      if (error) console.error("[getViewerProfile] db error", error.message);
      return data ?? null;
    },
    [`profile:${userId}`],
    { revalidate: 60, tags: [`profile:${userId}`] }
  )();

const fetchOnboardingProgress = (userId: string) =>
  unstable_cache(
    async (): Promise<ProgressRow | null> => {
      // Admin client + strict .eq("user_id", userId) — same justified scope as
      // fetchViewerProfile (post-0029 column lockdown). SECURITY-CRITICAL: never widen.
      const { data, error } = await createAdminClient()
        .from("onboarding_progress")
        .select("mandatory_done, tour_version, last_step_id, completed_steps, dismissed, completed_at")
        .eq("user_id", userId) // owner-scoped — SECURITY-CRITICAL: never widen this filter
        .maybeSingle();
      if (error) console.error("[getOnboardingProgress] db error", error.message);
      return data ?? null;
    },
    [`onboarding:${userId}`],
    { revalidate: 120, tags: [`onboarding:${userId}`] }
  )();

const fetchGymCount = (userId: string) =>
  unstable_cache(
    async () => {
      // Admin client + strict .eq("user_id", userId) — RLS-bound RSC client can fail
      // to resolve the cookie session in the layout context, silently returning 0
      // rows and making gymCount=0 so the gym step never auto-skips. SECURITY-CRITICAL.
      const { data, error } = await createAdminClient()
        .from("user_gyms")
        .select("id")
        .eq("user_id", userId); // SECURITY-CRITICAL: never widen this filter
      if (error) console.error("[getGymCount] user_gyms query failed:", error.message);
      return data?.length ?? 0;
    },
    [`gyms-count:${userId}`],
    { revalidate: 300, tags: [`gyms:${userId}`] }
  )();

// The viewer's own profile row, fetched once per request (React.cache) and
// cached cross-request (unstable_cache, 60s TTL). Invalidated by profile PATCH.
export const getViewerProfile = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  return fetchViewerProfile(user.id);
});

// The viewer's own onboarding_progress row. Cached 120s; invalidated by
// onboarding-progress PATCH. Null on new user / fetch failure — TourProvider
// handles via defaultProgress() (D-06).
export const getOnboardingProgress = cache(async (): Promise<ProgressRow | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  return fetchOnboardingProgress(user.id);
});

// Count of the viewer's registered gyms. Cached 5 min; invalidated when a gym
// is added or deleted. Used by the (tabs) layout for tour auto-skip logic.
export const getGymCount = cache(async () => {
  const user = await getAuthUser();
  if (!user) return 0;
  return fetchGymCount(user.id);
});
