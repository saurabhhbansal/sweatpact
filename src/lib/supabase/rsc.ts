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
