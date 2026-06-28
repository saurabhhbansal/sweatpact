"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Guard: prevent double-init on React StrictMode double-invoke or HMR
    if (posthog.__loaded) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest",
      // REQUIRED: automatic pageview fires only once at init; misses all SPA navigation.
      // PostHogPageview component handles manual $pageview capture on each route change.
      capture_pageview: false,
      // REQUIRED: uncontrolled noise; typed EVENT catalog (@/lib/analytics/events) is the only event source.
      autocapture: false,
      // No anonymous profiles until posthog.identify() is called (FOUND-01, T-07-03)
      person_profiles: "identified_only",
      defaults: "2026-01-30",
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
