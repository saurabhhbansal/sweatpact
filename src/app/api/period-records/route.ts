import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reconcileUserDay } from "@/lib/checkin-reconciliation";
import { listUserMemberships } from "@/lib/groups";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { localDay, normalizeTimeZone } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 90;

const Body = z.object({
  local_day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  flow_level: z.enum(["light", "medium", "heavy", "unspecified"]),
});

function isWithinWindow(day: string, today: string): boolean {
  const [ya, ma, da] = day.split("-").map(Number);
  const [yb, mb, db] = today.split("-").map(Number);
  const diffMs =
    Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da);
  const diffDays = Math.round(diffMs / 86_400_000);
  return diffDays >= 0 && diffDays <= WINDOW_DAYS;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { local_day, flow_level } = parsed.data;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, timezone, gender")
    .eq("id", auth.user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "no_profile" }, { status: 404 });
  }
  if (profile.gender !== "female") {
    return NextResponse.json({ error: "gender_mismatch" }, { status: 400 });
  }

  const today = localDay(new Date(), normalizeTimeZone(profile.timezone));
  if (!isWithinWindow(local_day, today)) {
    return NextResponse.json({ error: "out_of_window" }, { status: 400 });
  }

  // 1) Upsert the flow record (source of truth for stats).
  const { error: periodError } = await admin
    .from("period_records")
    .upsert(
      { user_id: profile.id, local_day, flow_level, source: "manual" as const },
      { onConflict: "user_id,local_day" }
    );
  if (periodError) {
    return NextResponse.json(
      { error: "db_error", detail: periodError.message },
      { status: 500 }
    );
  }

  // 2) Mirror as period_day in checkin_events, but only if there's no verified
  // check-in that day. Don't overwrite real gym attendance.
  const { data: existing } = await admin
    .from("checkin_events")
    .select("status")
    .eq("user_id", profile.id)
    .eq("local_day", local_day);
  const hasVerifiedOrUnverified = (existing ?? []).some(
    (r) => r.status === "verified" || r.status === "unverified"
  );
  const hasPeriodAlready = (existing ?? []).some((r) => r.status === "period_day");

  if (!hasVerifiedOrUnverified && !hasPeriodAlready) {
    // Replace any rejected/missed/other-excused rows for this day with period_day.
    await admin
      .from("checkin_events")
      .delete()
      .eq("user_id", profile.id)
      .eq("local_day", local_day);

    const memberships = await listUserMemberships(admin, profile.id);
    const submission_id = crypto.randomUUID();
    const occurred_at = `${local_day}T00:00:00Z`;
    const rows =
      memberships.length > 0
        ? memberships.map((m) => ({
            user_id: profile.id,
            group_id: m.group_id,
            local_day,
            status: "period_day" as const,
            source: "manual" as const,
            submission_id,
            occurred_at,
          }))
        : [
            {
              user_id: profile.id,
              group_id: null,
              local_day,
              status: "period_day" as const,
              source: "manual" as const,
              submission_id,
              occurred_at,
            },
          ];
    const { error: insertError } = await admin.from("checkin_events").insert(rows);
    if (insertError) {
      return NextResponse.json(
        { error: "db_error", detail: insertError.message },
        { status: 500 }
      );
    }
  }

  await reconcileUserDay(admin, { userId: profile.id, localDay: local_day, now: new Date() });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const local_day = req.nextUrl.searchParams.get("local_day");
  if (!local_day || !/^\d{4}-\d{2}-\d{2}$/.test(local_day)) {
    return NextResponse.json({ error: "missing_local_day" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, timezone, gender")
    .eq("id", auth.user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "no_profile" }, { status: 404 });
  }
  if (profile.gender !== "female") {
    return NextResponse.json({ error: "gender_mismatch" }, { status: 400 });
  }

  const today = localDay(new Date(), normalizeTimeZone(profile.timezone));
  if (!isWithinWindow(local_day, today)) {
    return NextResponse.json({ error: "out_of_window" }, { status: 400 });
  }

  await admin
    .from("period_records")
    .delete()
    .eq("user_id", profile.id)
    .eq("local_day", local_day);

  // Remove any period_day check-ins for that day.
  await admin
    .from("checkin_events")
    .delete()
    .eq("user_id", profile.id)
    .eq("local_day", local_day)
    .eq("status", "period_day");

  await reconcileUserDay(admin, { userId: profile.id, localDay: local_day, now: new Date() });

  return NextResponse.json({ ok: true });
}
