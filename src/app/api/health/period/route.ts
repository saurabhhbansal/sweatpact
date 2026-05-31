import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reconcileUserDay } from "@/lib/checkin-reconciliation";
import { listUserMemberships } from "@/lib/groups";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLOW_VALUES = ["light", "medium", "heavy", "unspecified"] as const;
type Flow = (typeof FLOW_VALUES)[number];

const Body = z.object({
  user_id: z.string().uuid(),
  secret: z.string().min(8),
  // Last 60 days max to bound payload size.
  dates: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        flow: z.enum(FLOW_VALUES),
      })
    )
    .max(60),
});

// Apple Health menstrual flow ordering (highest to lowest).
const FLOW_RANK: Record<Flow, number> = {
  heavy: 4,
  medium: 3,
  light: 2,
  unspecified: 1,
};

const EXCUSED_STATUSES = new Set(["sick_day", "gym_closed", "rest_day", "period_day"]);
const WINDOW_DAYS = 60;

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { user_id, secret, dates } = parsed.data;
  const admin = createAdminClient();

  // Auth via webhook secret (same pattern as /api/checkin).
  const { data: secretRow } = await admin
    .from("profile_secrets")
    .select("user_id, webhook_secret")
    .eq("user_id", user_id)
    .maybeSingle();
  if (!secretRow || secretRow.webhook_secret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, gender, timezone")
    .eq("id", user_id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "no_profile" }, { status: 404 });
  }
  if (profile.gender !== "female") {
    return NextResponse.json({ error: "gender_mismatch" }, { status: 400 });
  }

  // Restrict the date window so a misbehaving Shortcut can't dump years of data.
  const now = new Date();
  const earliest = new Date(now);
  earliest.setUTCDate(earliest.getUTCDate() - WINDOW_DAYS);
  const earliestKey = earliest.toISOString().slice(0, 10);
  const todayKey = now.toISOString().slice(0, 10);

  // Aggregate by day, keeping the highest flow per day.
  const byDay = new Map<string, Flow>();
  for (const row of dates) {
    if (row.date < earliestKey || row.date > todayKey) continue;
    const existing = byDay.get(row.date);
    if (!existing || FLOW_RANK[row.flow] > FLOW_RANK[existing]) {
      byDay.set(row.date, row.flow);
    }
  }

  if (byDay.size === 0) {
    await admin
      .from("profiles")
      .update({ period_last_synced_at: new Date().toISOString() })
      .eq("id", user_id);
    return NextResponse.json({ ok: true, processed: 0, skipped: 0 });
  }

  // 1) Upsert period_records (always — flow data is the source of truth).
  const periodRows = Array.from(byDay.entries()).map(([local_day, flow_level]) => ({
    user_id,
    local_day,
    flow_level,
    source: "health" as const,
  }));
  const { error: periodError } = await admin
    .from("period_records")
    .upsert(periodRows, { onConflict: "user_id,local_day" });
  if (periodError) {
    return NextResponse.json(
      { error: "db_error", detail: periodError.message },
      { status: 500 }
    );
  }

  // 2) For each day, mirror into checkin_events as period_day where appropriate.
  const memberships = await listUserMemberships(admin, user_id);
  const groupIds = memberships.map((m) => m.group_id);
  const days = Array.from(byDay.keys());

  // Fetch existing check-ins for all touched days in one go.
  const { data: existingRows } = await admin
    .from("checkin_events")
    .select("local_day, status")
    .eq("user_id", user_id)
    .in("local_day", days);

  // Build a per-day "best status" map so we know what's already there.
  const bestByDay = new Map<string, string>();
  for (const row of (existingRows ?? []) as Array<{ local_day: string; status: string }>) {
    const cur = bestByDay.get(row.local_day);
    if (!cur || statusRank(row.status) > statusRank(cur)) {
      bestByDay.set(row.local_day, row.status);
    }
  }

  let processed = 0;
  let skipped = 0;
  const reconcileDays: string[] = [];

  for (const local_day of days) {
    const existing = bestByDay.get(local_day);
    // Already verified or already a period_day → skip.
    if (existing === "verified" || existing === "unverified") {
      skipped++;
      continue;
    }
    if (existing === "period_day") {
      skipped++;
      continue;
    }
    // Any other excused state (sick/rest/gym_closed) → defer to user choice.
    if (existing && EXCUSED_STATUSES.has(existing) && existing !== "period_day") {
      skipped++;
      continue;
    }

    const submission_id = crypto.randomUUID();
    const occurred_at = `${local_day}T00:00:00Z`;
    const rows =
      groupIds.length > 0
        ? groupIds.map((group_id) => ({
            user_id,
            group_id,
            local_day,
            status: "period_day" as const,
            source: "shortcut" as const,
            submission_id,
            occurred_at,
          }))
        : [
            {
              user_id,
              group_id: null,
              local_day,
              status: "period_day" as const,
              source: "shortcut" as const,
              submission_id,
              occurred_at,
            },
          ];
    const { error: insertError } = await admin.from("checkin_events").insert(rows);
    if (insertError) {
      // Stop processing further so we don't half-sync. The user can retry tomorrow.
      return NextResponse.json(
        { error: "db_error", detail: insertError.message, processed, skipped },
        { status: 500 }
      );
    }
    processed++;
    reconcileDays.push(local_day);
  }

  // 3) Reconcile daily_status for each newly-touched day.
  for (const localDay of reconcileDays) {
    await reconcileUserDay(admin, { userId: user_id, localDay, now: new Date() });
  }

  await admin
    .from("profiles")
    .update({ period_last_synced_at: new Date().toISOString() })
    .eq("id", user_id);

  return NextResponse.json({ ok: true, processed, skipped, total: byDay.size });
}

function statusRank(status: string): number {
  if (status === "verified") return 6;
  if (status === "unverified") return 5;
  if (["sick_day", "gym_closed", "rest_day", "period_day"].includes(status)) return 4;
  if (status === "missed") return 2;
  if (status === "rejected") return 1;
  return 0;
}
