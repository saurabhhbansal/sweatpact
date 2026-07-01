import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServerEvent } from "@/lib/analytics/server";
import { EVENT } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  obligation_id: z.string().uuid(),
  amount_cents: z.number().int().nonnegative().optional(),
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
  const { obligation_id, amount_cents, note } = parsed.data;

  // obligations / settlements are RLS read-only for users; the writes below run
  // through the admin client, gated by the explicit ownership check.
  const admin = createAdminClient();

  const { data: oblig } = await admin
    .from("obligations")
    .select("id, from_user, to_user, amount_cents, status, group_id")
    .eq("id", obligation_id)
    .single();
  if (!oblig) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Either party may mark as settled.
  if (oblig.from_user !== auth.user.id && oblig.to_user !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Only a live (pending) debt can be settled — never a voided/disputed one, and
  // never one already settled. `amount_cents` from the body is intentionally
  // ignored: partial settlement isn't modeled, so we always record the full debt.
  if (oblig.status !== "pending") {
    return NextResponse.json(
      { error: "not_settleable", status: oblig.status },
      { status: 409 }
    );
  }
  void amount_cents; // accepted for backward-compat but not used

  const { data: settleRow, error: settleErr } = await admin
    .from("settlements")
    .insert({
      obligation_id,
      marked_by: auth.user.id,
      amount_cents: oblig.amount_cents,
      note: note ?? null,
    })
    .select("id")
    .single();
  if (settleErr) {
    return NextResponse.json(
      { error: "db_error", detail: settleErr.message },
      { status: 500 }
    );
  }
  // Atomic transition: only flip pending→settled. If another concurrent request
  // already settled it, this matches 0 rows — roll back our settlement and 409,
  // so a raced double-submit can never record two settlements.
  const { data: updatedRows, error: updateErr } = await admin
    .from("obligations")
    .update({ status: "settled" })
    .eq("id", obligation_id)
    .eq("status", "pending")
    .select("id");
  if (updateErr) {
    await admin.from("settlements").delete().eq("id", settleRow.id);
    return NextResponse.json(
      { error: "db_error", detail: updateErr.message },
      { status: 500 }
    );
  }
  if (!updatedRows || updatedRows.length === 0) {
    // Lost the race: someone else settled/voided between our read and update.
    await admin.from("settlements").delete().eq("id", settleRow.id);
    return NextResponse.json({ error: "not_settleable" }, { status: 409 });
  }

  await captureServerEvent(auth.user.id, EVENT.FINANCIAL_SETTLEMENT_RECORDED, {
    obligation_id,
    group_id: oblig.group_id,
  });
  return NextResponse.json({ ok: true });
}
