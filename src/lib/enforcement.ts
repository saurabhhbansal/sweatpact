import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileUserDay, reconcileMostRecentClosedWeek } from "@/lib/checkin-reconciliation";
import { localDay, normalizeTimeZone, previousLocalDay } from "@/lib/time";

type EnforcementResult = {
  scanned: number;
  penalized: number;
  skipped: number;
  weeklyChecked: number;
  errors: number;
  penalized_user_ids: string[];
};

export async function runEnforcement(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<EnforcementResult> {
  const result: EnforcementResult = { scanned: 0, penalized: 0, skipped: 0, weeklyChecked: 0, errors: 0, penalized_user_ids: [] };

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
        result.penalized_user_ids.push(profile.id);
      } else {
        result.skipped += 1;
      }

      // Daily catch-up: re-check the most recently closed ISO week on every run.
      // On a Monday run this is behavior-identical to the old Sunday-only trigger
      // (last closed week's Sunday == yesterday); on every other day it safely
      // re-reconciles that same week via the idempotent reconciler, healing a
      // missed/timed-out post-Sunday run. weeklyChecked now counts catch-up attempts.
      const today = localDay(now, timezone);
      result.weeklyChecked += 1;
      await reconcileMostRecentClosedWeek(admin, {
        userId: profile.id,
        today,
        now,
      });
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
