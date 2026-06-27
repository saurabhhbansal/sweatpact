"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import posthog from "posthog-js";

// NOTE: This component must be wrapped in <Suspense fallback={null}> in the root layout
// because useSearchParams() causes a static-generation bailout. The wrapper is added in Plan 04.
export function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Guard: prevent dropped events if SDK has not yet initialised (race with useEffect in PostHogProvider)
    if (!posthog.__loaded) return;

    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += "?" + qs;

    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
