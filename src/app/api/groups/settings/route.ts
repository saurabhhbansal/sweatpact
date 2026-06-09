import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMembership, isManagerRole } from "@/lib/groups";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  group_id: z.string().uuid(),
  default_penalty_cents: z.number().int().nonnegative().max(1_000_000).optional(),
  name: z.string().trim().min(1).max(80).optional(),
});

export async function PATCH(req: NextRequest) {
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

  const { group_id: groupId, default_penalty_cents, name } = parsed.data;
  if (default_penalty_cents === undefined && name === undefined) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const membership = await getMembership(supabase, auth.user.id, groupId);
  if (!membership || !isManagerRole(membership.role)) {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (default_penalty_cents !== undefined) updates.default_penalty_cents = default_penalty_cents;
  if (name !== undefined) updates.name = name;

  const admin = createAdminClient();
  const { error } = await admin.from("groups").update(updates).eq("id", groupId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
