import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(0).max(100).optional(),
  username: z
    .string()
    .regex(/^[A-Za-z0-9_]{3,20}$/, "username_format")
    .transform((v) => v.toLowerCase())
    .optional(),
  profile_visibility: z.enum(["public", "private"]).optional(),
  avatar_url: z.string().url().nullable().optional(),
  onboarding_complete: z.boolean().optional(),
  timezone: z
    .string()
    .min(1)
    .max(64)
    .refine((v) => isValidTimeZone(v), "invalid_timezone")
    .optional(),
  gym_lat: z.number().min(-90).max(90).optional(),
  gym_lng: z.number().min(-180).max(180).optional(),
  gym_radius_m: z.number().int().min(20).max(5000).optional(),
  gender: z.enum(["male", "female"]).optional(),
  weekly_goal: z.number().int().min(1).max(7).optional(),
  rest_days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  period_sync_enabled: z.boolean().optional(),
  notify_unverified_checkin: z.boolean().optional(),
  notify_rest_day: z.boolean().optional(),
  notify_cycle_share: z.boolean().optional(),
  rotate_secret: z.boolean().optional(),
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

  // Cross-field validation: rest_days + weekly_goal must leave enough gym days
  const { weekly_goal, rest_days } = parsed.data;
  if (rest_days !== undefined && weekly_goal !== undefined) {
    if (rest_days.length + weekly_goal > 7) {
      return NextResponse.json(
        { error: "too_many_rest_days", detail: `rest_days (${rest_days.length}) + weekly_goal (${weekly_goal}) cannot exceed 7` },
        { status: 400 }
      );
    }
  } else if (rest_days !== undefined) {
    const { data: profile } = await supabase.from("profiles").select("weekly_goal").eq("id", auth.user.id).single();
    const currentGoal = (profile as any)?.weekly_goal ?? 4;
    if (rest_days.length + currentGoal > 7) {
      return NextResponse.json(
        { error: "too_many_rest_days", detail: `rest_days (${rest_days.length}) + weekly_goal (${currentGoal}) cannot exceed 7` },
        { status: 400 }
      );
    }
  }

  const update: Record<string, unknown> = { ...parsed.data };
  delete update.rotate_secret;

  if (parsed.data.rotate_secret) {
    // 24 random bytes hex, stored in profile_secrets (self-only RLS).
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const newSecret = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { error: secretError } = await supabase
      .from("profile_secrets")
      .upsert(
        { user_id: auth.user.id, webhook_secret: newSecret },
        { onConflict: "user_id" }
      );
    if (secretError) {
      return NextResponse.json(
        { error: "db_error", detail: secretError.message },
        { status: 500 }
      );
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", auth.user.id)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505" && error.message.includes("username")) {
      return NextResponse.json(
        { error: "username_taken" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, profile: data });
}
