import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileUserDay, reconcileUserWeek } from "@/lib/checkin-reconciliation";
import { normalizeTimeZone, previousLocalDay } from "@/lib/time";

type EnforcementResult = {
  scanned: number;
  penalized: number;
  skipped: number;
  weeklyChecked: number;
  errors: number;
};

// Returns day-of-week for a YYYY-MM-DD string: 0=Sun, 1=Mon, …, 6=Sat
function dayOfWeekFor(localDay: string): number {
  const [y, m, d] = localDay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export async function runEnforcement(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<EnforcementResult> {
  const result: EnforcementResult = { scanned: 0, penalized: 0, skipped: 0, weeklyChecked: 0, errors: 0 };

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, timezone")
    .limit(10_000);

  if (error) throw error;
  if (!profiles) return result;

  for (const profile of profiles as Array<{ id: string; timezone: string | null }>) {
    result.scanned += 1;

    try {
      const timezone = normalizeTimeZone(profile.timezone);
      const day = previousLocalDay(now, timezone);

      const { data: existing } = await admin
        .from("daily_status")
        .select("status")
        .eq("user_id", profile.id)
        .eq("local_day", day)
        .maybeSingle();

      const reconciled = await reconcileUserDay(admin, {
        userId: profile.id,
        localDay: day,
        now,
      });

      if (reconciled.status === "missed" && existing?.status !== "missed") {
        result.penalized += 1;
      } else {
        result.skipped += 1;
      }

      // If yesterday was a Sunday (day 0), the ISO week just ended — run weekly check.
      if (dayOfWeekFor(day) === 0) {
        result.weeklyChecked += 1;
        await reconcileUserWeek(admin, {
          userId: profile.id,
          weekEndDay: day,
          now,
        });
      }
    } catch (err) {
      // A money-cron failure must not be invisible: log it with context and
      // count it so the cron response surfaces a non-zero error total.
      result.errors += 1;
      console.error(
        `[enforcement] failed for user ${profile.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (result.errors > 0) {
    console.error(
      `[enforcement] completed with ${result.errors} error(s) of ${result.scanned} scanned`
    );
  }

  return result;
}
