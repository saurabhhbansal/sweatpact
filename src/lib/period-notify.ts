import type { SupabaseClient } from "@supabase/supabase-js";
import { computePeriodStats } from "@/lib/period-stats";
import { sendPushToUser } from "@/lib/push";
import { localDay, normalizeTimeZone } from "@/lib/time";

// Days before predicted period start at which the reminder fires.
const REMINDER_DAYS_BEFORE = 2;

/**
 * Sends "period approaching" notifications to grantees who opted in.
 * Called once per day from the cron job. Best-effort — never throws.
 */
export async function sendPeriodReminders(
  admin: SupabaseClient,
  now: Date
): Promise<void> {
  try {
    // All opted-in sharing relationships.
    const { data: rows, error: rowsError } = await admin
      .from("period_sharing")
      .select("owner_id, shared_with_id")
      .eq("notify_approaching", true)
      .limit(10_000);

    if (rowsError) throw rowsError;
    if (!rows || rows.length === 0) return;

    // Deduplicate owners so we only compute stats once per owner.
    const ownerIds = [...new Set(rows.map((r) => r.owner_id))];

    // Only fetch recent records — period stats only need ~2 years of history.
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const cutoff = twoYearsAgo.toISOString().slice(0, 10);

    // Load owner profiles (timezone) and period records in parallel.
    const [profilesRes, recordsRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, timezone, name, username")
        .in("id", ownerIds)
        .limit(10_000),
      admin
        .from("period_records")
        .select("user_id, local_day, flow_level")
        .in("user_id", ownerIds)
        .gte("local_day", cutoff)
        .order("local_day", { ascending: true }),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (recordsRes.error) throw recordsRes.error;

    const profiles = profilesRes.data ?? [];
    const allRecords = recordsRes.data ?? [];

    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const recordsByOwner = new Map<string, { local_day: string; flow_level: string }[]>();
    for (const r of allRecords) {
      const list = recordsByOwner.get(r.user_id) ?? [];
      list.push(r);
      recordsByOwner.set(r.user_id, list);
    }

    // Map owner_id → list of grantee user_ids who want the reminder.
    const granteesByOwner = new Map<string, string[]>();
    for (const row of rows) {
      const list = granteesByOwner.get(row.owner_id) ?? [];
      list.push(row.shared_with_id);
      granteesByOwner.set(row.owner_id, list);
    }

    for (const ownerId of ownerIds) {
      const owner = profileById.get(ownerId);
      if (!owner) continue;

      const today = localDay(now, normalizeTimeZone(owner.timezone));
      const records = (recordsByOwner.get(ownerId) ?? []).map((r) => ({
        local_day: r.local_day,
        flow_level: r.flow_level as "light" | "medium" | "heavy" | "unspecified",
      }));

      const stats = computePeriodStats(records, today);
      if (
        stats.daysUntilPredicted === null ||
        stats.daysUntilPredicted !== REMINDER_DAYS_BEFORE
      ) {
        continue;
      }

      const ownerDisplay =
        owner.name?.trim() ||
        (owner.username ? `@${owner.username}` : "Someone");

      const grantees = granteesByOwner.get(ownerId) ?? [];

      // Insert in-app notifications.
      if (grantees.length > 0) {
        const notificationRows = grantees.map((granteeId) => ({
          user_id: granteeId,
          type: "partner_period_reminder",
          payload: {
            owner_id: ownerId,
            owner_name: owner.name ?? null,
            owner_username: owner.username ?? null,
            predicted_start: stats.nextPredictedStart,
            days_until: stats.daysUntilPredicted,
          },
        }));
        await admin.from("notifications").insert(notificationRows);
      }

      // Send push notifications.
      await Promise.all(
        grantees.map((granteeId) =>
          sendPushToUser(admin, granteeId, {
            title: "Period reminder",
            body: `${ownerDisplay}'s period may be starting in ${REMINDER_DAYS_BEFORE} days.`,
            url: owner.username ? `/u/${owner.username}` : "/notifications",
            tag: `period-reminder-${ownerId}-${stats.nextPredictedStart}`,
          })
        )
      );
    }
  } catch {
    // Best-effort — never let this break the cron response.
  }
}
