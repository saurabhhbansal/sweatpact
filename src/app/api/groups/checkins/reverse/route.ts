import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reconcileUserDay } from "@/lib/checkin-reconciliation";
import { getMembership, isManagerRole } from "@/lib/groups";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  group_id: z.string().uuid(),
  checkin_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

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

  const { group_id: groupId, checkin_id: checkinId, reason } = parsed.data;
  const callerMembership = await getMembership(supabase, auth.user.id, groupId);
  if (!callerMembership || !isManagerRole(callerMembership.role)) {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: checkin } = await admin
    .from("checkin_events")
    .select("id, user_id, group_id, local_day, status, submission_id")
    .eq("id", checkinId)
    .maybeSingle();

  if (!checkin || checkin.group_id !== groupId) {
    return NextResponse.json({ error: "checkin_not_found" }, { status: 404 });
  }

  if (checkin.status !== "unverified") {
    return NextResponse.json({ error: "only_unverified_can_be_reversed" }, { status: 409 });
  }

  const { error: updateError } = await admin
    .from("checkin_events")
    .update({ status: "rejected" })
    .eq("id", checkinId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await reconcileUserDay(admin, {
    userId: checkin.user_id,
    localDay: checkin.local_day,
    now: new Date(),
  });

  await admin.from("audit_log").insert({
    user_id: checkin.user_id,
    kind: "reverse_checkin",
    payload: {
      checkin_id: checkin.id,
      submission_id: checkin.submission_id,
      group_id: groupId,
      reversed_by: auth.user.id,
      reason: reason ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
