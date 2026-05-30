import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMembership } from "@/lib/groups";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  group_id: z.string().uuid(),
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

  const membership = await getMembership(supabase, auth.user.id, parsed.data.group_id);
  if (!membership || !membership.group) {
    return NextResponse.json({ error: "not_in_group" }, { status: 409 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const url = membership.group.invite_code
    ? `${base}/join?code=${membership.group.invite_code}`
    : null;

  return NextResponse.json({
    ok: true,
    invite_code: membership.group.invite_code,
    invite_url: url,
    group: { id: membership.group.id, name: membership.group.name },
  });
}
