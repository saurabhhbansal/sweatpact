import { cache } from "react";
import { createClient } from "./server";

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
  const { data } = await getSupabaseRSC()
    .from("profiles")
    .select(
      "id, username, name, email, gender, timezone, created_at, weekly_goal, rest_days, onboarding_complete, avatar_url, notify_unverified_checkin, notify_rest_day, notify_cycle_share"
    )
    .eq("id", user.id)
    .single();
  return data;
});
