import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  PatchBody,
  mergeProgress,
  defaultProgress,
  type ProgressRow,
} from "@/lib/onboarding-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT_COLS =
  "mandatory_done, tour_version, last_step_id, completed_steps, dismissed, completed_at";

export async function GET() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("onboarding_progress")
    .select(SELECT_COLS)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 }
    );
  }

  // Defensive default for the missing-row case (D-01) — never 404/500.
  return NextResponse.json((data as ProgressRow | null) ?? defaultProgress());
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Read the caller's current row (server-authoritative source of truth).
  const { data: existing, error: readError } = await supabase
    .from("onboarding_progress")
    .select(SELECT_COLS)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json(
      { error: "db_error", detail: readError.message },
      { status: 500 }
    );
  }

  // Server-authoritative dedupe-append; replaying the same body is a no-op.
  const merged = mergeProgress(
    (existing as ProgressRow | null) ?? defaultProgress(),
    parsed.data
  );

  const { data, error } = await supabase
    .from("onboarding_progress")
    .upsert({ user_id: auth.user.id, ...merged }, { onConflict: "user_id" })
    .select(SELECT_COLS)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 }
    );
  }

  revalidateTag(`onboarding:${auth.user.id}`);
  return NextResponse.json({ ok: true, progress: data });
}
