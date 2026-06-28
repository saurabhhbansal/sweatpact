import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/analytics/server";
import { EVENT } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  default_penalty_cents: z.number().int().nonnegative().max(1_000_000).optional(),
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

  const admin = createAdminClient();
  const { data: group, error: groupError } = await admin
    .from("groups")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      owner_id: auth.user.id,
      default_penalty_cents: parsed.data.default_penalty_cents ?? 5000,
    })
    .select("id, invite_code, name")
    .single();

  if (groupError || !group) {
    return NextResponse.json(
      { error: "db_error", detail: groupError?.message },
      { status: 500 }
    );
  }

  const { error: memberError } = await admin.from("group_members").insert({
    group_id: group.id,
    user_id: auth.user.id,
    role: "owner",
  });

  if (memberError) {
    return NextResponse.json(
      { error: "db_error", detail: memberError.message },
      { status: 500 }
    );
  }

  await captureServerEvent(auth.user.id, EVENT.PACT_CREATED, { group_id: group.id });

  return NextResponse.json({ ok: true, group });
}
