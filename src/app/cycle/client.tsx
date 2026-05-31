"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Droplet } from "lucide-react";
import { PeriodDayEditor } from "@/components/progress-section";

/**
 * Quick "log today" action for the Cycle tab. Reuses the same flow editor the
 * calendar uses, so there's a single source of truth for logging period days.
 */
export function LogTodayButton({
  today,
  currentFlow,
}: {
  today: string;
  currentFlow: "light" | "medium" | "heavy" | "unspecified" | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
      >
        <Droplet className="h-4 w-4" />
        {currentFlow ? "Edit today's period day" : "Log today as a period day"}
      </button>
      {open ? (
        <PeriodDayEditor
          day={today}
          currentFlow={currentFlow}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            startTransition(() => router.refresh());
          }}
        />
      ) : null}
    </>
  );
}
