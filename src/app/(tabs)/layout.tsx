import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getViewerProfile, getOnboardingProgress, getGymCount } from "@/lib/supabase/rsc";
import { MobileNav, TopNav } from "@/components/nav";
import { RefreshOnFocus } from "@/components/refresh-on-focus";
import { TourProvider } from "@/components/tour-provider";
import CoachmarkRenderer from "@/components/tour/coachmark-renderer-dynamic";

export const dynamic = "force-dynamic";

// Copied from src/app/onboarding/username/page.tsx — one definition, one regex.
// D-01: the layout gate is the ONLY username redirect going forward.
function isAutoUsername(u: string | null) {
  return !u || /^user_[a-f0-9]{8}$/.test(u);
}

// getViewerProfile is request-cached, so the two nav slots and the page all
// share one auth round trip and one profiles select.
async function getNavProfile() {
  const profile = await getViewerProfile();
  if (!profile) redirect("/login");
  return profile;
}

async function TopBar() {
  const profile = await getNavProfile();
  return (
    <TopNav
      name={profile.name?.trim() || profile.email || "Account"}
      username={profile.username}
    />
  );
}

async function BottomBar() {
  const profile = await getNavProfile();
  return <MobileNav username={profile.username ?? undefined} />;
}

// Shared layout for all signed-in tab routes. Rendering the navs here (instead
// of per page) keeps them mounted across client navigations, so the bottom
// nav's sliding indicator actually glides between tabs. The navs are streamed
// behind Suspense with prop-less navs as the instant fallback, so the shell
// paints on hard loads without waiting for the profile fetch.
//
// Gate: redirects to /onboarding/username when the profile is missing or the
// username is auto-generated (D-01, ONB-02). NO onboarding_complete check (D-02).
// This is the ONLY username redirect gate going forward; per-page redirects have
// been removed (D-03).
//
// Hydration: getOnboardingProgress() is request-cached and reads the progress row
// server-side — no client-side refetch, no flash (D-04, RESEARCH Pitfall 1).
// On null (new user / fetch failure) TourProvider uses defaultProgress() (D-06).
export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Username-only gate (D-01, ONB-02). Runs before JSX so nav never flashes.
  const profile = await getViewerProfile();
  if (!profile) redirect("/login");
  if (isAutoUsername(profile.username)) redirect("/onboarding/username");
  // NO onboarding_complete check here (D-02 — wizard bounce removed).

  // Server-side hydration read — direct request-cached DB read, NOT a self-fetch
  // of /api/onboarding-progress (RESEARCH Pitfall 1: no absolute URL needed,
  // no cookie forwarding, no extra round trip).
  const initialProgress = await getOnboardingProgress();

  // Real skip-on-complete probe values, computed server-side (D-07: no new
  // client-side fetch). gymCount is cross-request cached in getGymCount (5 min
  // TTL, invalidated on gym add/delete). restDays straight off the profile row.
  const gymCount = await getGymCount();
  const rawRestDays = profile.rest_days;
  const restDays = Array.isArray(rawRestDays)
    ? rawRestDays.filter((d): d is number => typeof d === "number")
    : [];

  return (
    <>
      <RefreshOnFocus />
      <Suspense fallback={<TopNav />}>
        <TopBar />
      </Suspense>
      {/* Reserves the fixed header's height in flow (paddingTop safe-area +
          the 3.5rem bar) so page content starts below it. The header is fixed
          rather than sticky because the root's overflow-x clip breaks
          position: sticky on iOS. */}
      <div
        aria-hidden="true"
        style={{ height: "calc(max(env(safe-area-inset-top), 0.75rem) + 3.5rem)" }}
      />
      <TourProvider initialProgress={initialProgress} gymCount={gymCount} restDays={restDays}>
        {children}
        {/* Client-only coachmark engine (next/dynamic ssr:false, D-03). Mounted
            INSIDE TourProvider so its useTour() resolves; it renders the joyride
            overlay into #tour-root and is null whenever no step is pending. */}
        <CoachmarkRenderer />
      </TourProvider>
      <Suspense fallback={<MobileNav />}>
        <BottomBar />
      </Suspense>
    </>
  );
}
