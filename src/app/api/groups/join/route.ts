import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  invite_code: z.string().min(4).max(64),
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
  const { data: group } = await admin
    .from("groups")
    .select("id, name")
    .eq("invite_code", parsed.data.invite_code.trim().toLowerCase())
    .maybeSingle();

  if (!group) {
    return NextResponse.json({ error: "invalid_invite" }, { status: 404 });
  }

  const { data: existingMembership } = await admin
    .from("group_members")
    .select("group_id")
    .eq("group_id", group.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (existingMembership) {
    return NextResponse.json({ error: "already_in_group" }, { status: 409 });
  }

  const { error: memberError } = await admin.from("group_members").insert({
    group_id: group.id,
    user_id: auth.user.id,
    role: "member",
  });

  if (memberError) {
    return NextResponse.json(
      { error: "db_error", detail: memberError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, group });
}
