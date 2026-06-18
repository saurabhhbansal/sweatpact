"use client";

import dynamic from "next/dynamic";

/**
 * Client-only entry point for the coachmark engine.
 *
 * react-joyride reads the DOM and `window`/`document` at module scope, so it must
 * never run on the server (D-03, RESEARCH Pitfall — no SSR/hydration of the
 * overlay). Loading CoachmarkRenderer via next/dynamic with `ssr: false` keeps
 * joyride out of the server bundle and off the first-paint critical path; the
 * engine hydrates client-side only, after the (tabs) shell is interactive.
 *
 * The (tabs) layout mounts THIS default export inside <TourProvider> so the
 * renderer's useTour() resolves.
 */
const CoachmarkRenderer = dynamic(
  () => import("./coachmark-renderer").then((m) => m.CoachmarkRenderer),
  { ssr: false }
);

export default CoachmarkRenderer;
