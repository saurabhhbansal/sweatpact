"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/browser";

// Subscribes to Supabase auth state changes and maps them to PostHog identity calls.
// Uses session.user.id (Supabase UUID) as distinctId — never email or display name (T-07-03).
export function PostHogIdentity() {
  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        // UUID is non-guessable and contains no PII (T-07-03)
        posthog.identify(session.user.id);
      } else if (event === "SIGNED_OUT") {
        // Clear identified user from PostHog client so the next user gets a fresh profile
        posthog.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
