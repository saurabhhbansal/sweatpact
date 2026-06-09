import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

  const { data: oblig } = await supabase
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
  if (oblig.status === "settled") {
    return NextResponse.json({ error: "already_settled" }, { status: 409 });
  }

  const amt = amount_cents ?? oblig.amount_cents;
  const { data: settleRow, error: settleErr } = await supabase
    .from("settlements")
    .insert({
      obligation_id,
      marked_by: auth.user.id,
      amount_cents: amt,
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
  const { error: updateErr } = await supabase
    .from("obligations")
    .update({ status: "settled" })
    .eq("id", obligation_id);
  if (updateErr) {
    // Best-effort rollback: remove the orphaned settlement row.
    await supabase.from("settlements").delete().eq("id", settleRow.id);
    return NextResponse.json(
      { error: "db_error", detail: updateErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
