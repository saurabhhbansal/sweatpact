"use client";

import { useRouter } from "next/navigation";
import { GymSurface } from "@/components/onboarding/gym-surface";

export function GymOnboarding({ initialGymCount }: { initialGymCount: number }) {
  const router = useRouter();
  return (
    <GymSurface
      initialGymCount={initialGymCount}
      onComplete={() => router.push("/onboarding/shortcut")}
    />
  );
}
