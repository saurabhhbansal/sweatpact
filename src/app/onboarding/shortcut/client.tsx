"use client";

import { useRouter } from "next/navigation";
import { ShortcutSurface } from "@/components/onboarding/shortcut-surface";

export function FinishOnboardingButtons() {
  const router = useRouter();

  async function handleComplete() {
    // Legacy linear-wizard concern: flip onboarding_complete so the legacy
    // route ends onboarding. Kept in the shell (not the surface) per D-05 so a
    // future walkthrough mount of ShortcutSurface does NOT prematurely end
    // onboarding. This is the ONLY place onboarding_complete is written now.
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ onboarding_complete: true }),
    }).catch(() => ({}));
    router.push("/dashboard");
    router.refresh();
  }

  return <ShortcutSurface onComplete={handleComplete} />;
}
