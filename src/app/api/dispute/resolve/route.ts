import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMembership, isManagerRole } from "@/lib/groups";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  dispute_id: z.string().uuid(),
  // "void" cancels the disputed debt (resolved in the disputer's favour);
  // "uphold" keeps the debt and rejects the complaint.
  action: z.enum(["void", "uphold"]),
  note: z.string().max(2000).optional(),
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
  const { dispute_id, action, note } = parsed.data;

  // disputes / obligations are RLS read-only for users; reads and writes below
  // run through the admin client, gated by the explicit manager check.
  const admin = createAdminClient();

  const { data: dispute } = await admin
    .from("disputes")
    .select("id, group_id, target_type, target_id, status")
    .eq("id", dispute_id)
    .single();
  if (!dispute || !dispute.group_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (dispute.status !== "open") {
    return NextResponse.json({ error: "already_resolved" }, { status: 409 });
  }

  // Only a group manager/owner may resolve a dispute.
  const membership = await getMembership(supabase, auth.user.id, dispute.group_id);
  if (!membership || !isManagerRole(membership.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (action === "void") {
    // Collect the obligations this dispute targets, then void the unsettled
    // ones. We void (not delete) so reconciliation's idempotent upsert won't
    // recreate them, and so settled debts are never silently reversed.
    let obligationQuery = admin
      .from("obligations")
      .select("id, status")
      .eq("group_id", dispute.group_id);

    if (dispute.target_type === "obligation") {
      obligationQuery = obligationQuery.eq("id", dispute.target_id);
    } else if (dispute.target_type === "penalty_event") {
      obligationQuery = obligationQuery.eq("penalty_event_id", dispute.target_id);
    } else {
      obligationQuery = obligationQuery.eq("checkin_event_id", dispute.target_id);
    }

    const { data: targetObligations, error: readErr } = await obligationQuery;
    if (readErr) {
      return NextResponse.json(
        { error: "db_error", detail: readErr.message },
        { status: 500 }
      );
    }

    const voidableIds = (targetObligations ?? [])
      .filter((o) => o.status === "pending" || o.status === "disputed")
      .map((o) => o.id);

    if (voidableIds.length > 0) {
      const { error: voidErr } = await admin
        .from("obligations")
        .update({ status: "voided", updated_at: new Date().toISOString() })
        .in("id", voidableIds);
      if (voidErr) {
        return NextResponse.json(
          { error: "db_error", detail: voidErr.message },
          { status: 500 }
        );
      }
    }
  }

  const { error: resolveErr } = await admin
    .from("disputes")
    .update({
      // "resolved" = acted on (debt voided); "rejected" = complaint denied.
      status: action === "void" ? "resolved" : "rejected",
      resolution_note: note ?? null,
      resolved_by: auth.user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", dispute_id)
    .eq("status", "open");
  if (resolveErr) {
    return NextResponse.json(
      { error: "db_error", detail: resolveErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, action });
}
