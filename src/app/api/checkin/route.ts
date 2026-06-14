import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeEqual } from "@/lib/secure-compare";
import { reconcileUserDay, reconcileWeekForDayIfClosed } from "@/lib/checkin-reconciliation";
import { EXCUSED_STATUSES } from "@/lib/derived-status";
import { notifyGroupCheckin } from "@/lib/checkin-notify";
import { listUserMemberships } from "@/lib/groups";
import { haversineMeters } from "@/lib/geo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { localDay, normalizeTimeZone } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  user_id: z.string().uuid().optional(),
  secret: z.string().min(8).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  source: z.enum(["shortcut", "manual"]).default("manual"),
  allow_unverified: z.boolean().optional().default(true),
  occurred_at: z.string().datetime().optional(),
});


type CheckinRow = {
  id: string;
  submission_id: string;
  group_id: string | null;
  status: string;
  occurred_at: string;
  distance_m: number | null;
};

function groupRowsBySubmission(rows: CheckinRow[]) {
  const grouped = new Map<string, CheckinRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.submission_id) ?? [];
    current.push(row);
    grouped.set(row.submission_id, current);
  }
  return grouped;
}

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

  const body = parsed.data;
  const admin = createAdminClient();

  let userId: string | null = null;
  if (body.user_id && body.secret) {
    const { data: secretRow, error: secretError } = await admin
      .from("profile_secrets")
      .select("user_id, webhook_secret")
      .eq("user_id", body.user_id)
      .maybeSingle();

    if (secretError) {
      return NextResponse.json({ error: "db_error", detail: secretError.message }, { status: 500 });
    }
    if (!secretRow || !safeEqual(secretRow.webhook_secret, body.secret)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    userId = secretRow.user_id;
  } else {
    const supabase = createServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    userId = data.user.id;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, timezone")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "no_profile" }, { status: 404 });
  }

  const memberships = await listUserMemberships(admin, profile.id);
  const occurredAt = body.occurred_at ? new Date(body.occurred_at) : new Date();
  const tz = normalizeTimeZone(profile.timezone);
  const day = localDay(occurredAt, tz);
  const today = localDay(new Date(), tz);

  // Reject check-ins for dates other than today or yesterday in the user's
  // local timezone. This prevents retroactively clearing missed-day penalties
  // by passing a stale occurred_at.
  const yesterday = localDay(new Date(Date.now() - 86_400_000), tz);
  if (day !== today && day !== yesterday) {
    return NextResponse.json(
      { error: "occurred_at_out_of_window", local_day: day },
      { status: 422 }
    );
  }

  let distance: number | null = null;
  let verified = false;

  if (typeof body.latitude === "number" && typeof body.longitude === "number") {
    const { data: gyms } = await admin
      .from("user_gyms")
      .select("lat, lng, radius_m")
      .eq("user_id", profile.id);
    for (const gym of gyms ?? []) {
      const d = haversineMeters(body.latitude, body.longitude, gym.lat, gym.lng);
      if (distance == null || d < distance) distance = d;
      if (d <= (gym.radius_m ?? 150)) verified = true;
    }
  }

  if (!verified && !body.allow_unverified) {
    return NextResponse.json(
      { error: "location_outside_radius", distance_m: distance },
      { status: 422 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  const { data: existingRows, error: existingError } = await admin
    .from("checkin_events")
    .select("id, submission_id, group_id, status, occurred_at, distance_m")
    .eq("user_id", profile.id)
    .eq("local_day", day)
    .order("occurred_at", { ascending: false });

  if (existingError) {
    return NextResponse.json(
      { error: "db_error", detail: existingError.message },
      { status: 500 }
    );
  }

  const rows = (existingRows ?? []) as CheckinRow[];
  // period_day is not a hard block — the user may still check in on their period.
  // All other excused statuses and verified are final for the day.
  if (rows.some((row) => row.status === "verified" || (EXCUSED_STATUSES.has(row.status) && row.status !== "period_day"))) {
    return NextResponse.json(
      { error: "already_checked_in", verified: true, distance_m: distance },
      { status: 409 }
    );
  }

  const rowsBySubmission = groupRowsBySubmission(rows);
  const latestSubmissionId = rows[0]?.submission_id ?? null;
  const latestRows = latestSubmissionId ? rowsBySubmission.get(latestSubmissionId) ?? [] : [];
  const hasLiveUnverified = latestRows.some((row) => row.status === "unverified");

  const groupIds = memberships.map((membership) => membership.group_id);
  const rowPayloadBase = {
    user_id: profile.id,
    occurred_at: occurredAt.toISOString(),
    local_day: day,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    distance_m: distance,
    status: verified ? "verified" : "unverified",
    source: body.source,
    ip,
    user_agent: userAgent,
  };

  let affectedRows: CheckinRow[] = [];
  let action: "created" | "updated" | "existing" = "created";
  let submissionId = latestSubmissionId ?? crypto.randomUUID();

  if (latestRows.length > 0 && hasLiveUnverified && verified) {
    const { error: updateError } = await admin
      .from("checkin_events")
      .update(rowPayloadBase)
      .eq("submission_id", latestSubmissionId)
      .in("status", ["unverified", "rejected"]);

    if (updateError) {
      return NextResponse.json(
        { error: "db_error", detail: updateError.message },
        { status: 500 }
      );
    }

    const existingGroupIds = new Set(
      latestRows
        .map((row) => row.group_id)
        .filter((groupId): groupId is string => Boolean(groupId))
    );

    const missingGroupIds = groupIds.filter((groupId) => !existingGroupIds.has(groupId));
    if (missingGroupIds.length > 0) {
      const { error: insertMissingError } = await admin.from("checkin_events").insert(
        missingGroupIds.map((groupId) => ({
          ...rowPayloadBase,
          group_id: groupId,
          submission_id: latestSubmissionId,
        }))
      );

      if (insertMissingError) {
        return NextResponse.json(
          { error: "db_error", detail: insertMissingError.message },
          { status: 500 }
        );
      }
    }

    submissionId = latestSubmissionId!;
    action = "updated";
  } else if (latestRows.length > 0 && hasLiveUnverified && !verified) {
    submissionId = latestSubmissionId!;
    action = "existing";
  } else {
    const rowsToInsert =
      groupIds.length > 0
        ? groupIds.map((groupId) => ({
            ...rowPayloadBase,
            group_id: groupId,
            submission_id: submissionId,
          }))
        : [
            {
              ...rowPayloadBase,
              group_id: null,
              submission_id: submissionId,
            },
          ];

    const { error: insertError } = await admin.from("checkin_events").insert(rowsToInsert);
    if (insertError) {
      return NextResponse.json(
        { error: "db_error", detail: insertError.message },
        { status: 500 }
      );
    }
  }

  const { data: refreshedRows, error: refreshError } = await admin
    .from("checkin_events")
    .select("id, submission_id, group_id, status, occurred_at, distance_m")
    .eq("submission_id", submissionId)
    .order("occurred_at", { ascending: false });

  if (refreshError) {
    return NextResponse.json(
      { error: "db_error", detail: refreshError.message },
      { status: 500 }
    );
  }

  affectedRows = (refreshedRows ?? []) as CheckinRow[];

  const reconcileNow = new Date();
  await reconcileUserDay(admin, {
    userId: profile.id,
    localDay: day,
    now: reconcileNow,
  });
  // A back-dated check-in (yesterday) that pushes the user over their weekly
  // goal should reverse a penalty already applied for that closed week.
  await reconcileWeekForDayIfClosed(admin, {
    userId: profile.id,
    day,
    today,
    now: reconcileNow,
  });

  await admin.from("audit_log").insert({
    user_id: profile.id,
    kind: "checkin",
    payload: {
      submission_id: submissionId,
      checkin_ids: affectedRows.map((row) => row.id),
      source: body.source,
      verified,
      distance_m: distance,
      action,
      groups: affectedRows.map((row) => row.group_id),
    },
    ip,
    user_agent: userAgent,
  });

  // Notify the other challenge members — but only when a real new check-in was
  // recorded (skip duplicate/no-op unverified re-submissions).
  if (action !== "existing") {
    await notifyGroupCheckin(admin, {
      actorId: profile.id,
      status: verified ? "verified" : "unverified",
      localDay: day,
    });
  }

  return NextResponse.json({
    ok: true,
    action,
    checkin: affectedRows[0] ?? null,
    checkins: affectedRows,
    submission_id: submissionId,
    verified,
    distance_m: distance,
  });
}
