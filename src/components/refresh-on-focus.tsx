"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Prefetched tab routes can serve data that's a few minutes old when the user
// switches to them. This refreshes the current route's server data when the
// app returns to the foreground (tab/app refocus), so a phone that's been in
// the user's pocket shows fresh streaks and balances on return — the native
// "instant shell, silent background refresh" pattern. A min-interval guard
// keeps rapid focus toggles from triggering a refresh storm.
const MIN_REFRESH_INTERVAL_MS = 30_000;

export function RefreshOnFocus() {
  const router = useRouter();
  const lastRefresh = useRef(Date.now());

  useEffect(() => {
    function maybeRefresh() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current < MIN_REFRESH_INTERVAL_MS) return;
      lastRefresh.current = now;
      router.refresh();
    }
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => document.removeEventListener("visibilitychange", maybeRefresh);
  }, [router]);

  return null;
}
