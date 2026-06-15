"use client";

import { useRouter } from "next/navigation";
import { ScheduleSurface } from "@/components/onboarding/schedule-surface";

export function ScheduleForm({
  initialGoal,
  initialRestDays,
}: {
  initialGoal: number;
  initialRestDays: number[];
}) {
  const router = useRouter();
  return (
    <ScheduleSurface
      initialGoal={initialGoal}
      initialRestDays={initialRestDays}
      onComplete={() => router.push("/onboarding/gym")}
    />
  );
}
