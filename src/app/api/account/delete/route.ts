import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const userId = auth.user.id;

  // Best-effort storage cleanup. Every public.* table that references this
  // user cascades on delete (checkin_events, daily_status, obligations,
  // penalty_events, period_records, profile_secrets, push_subscriptions,
  // notifications, group_members, owned groups, …) and the
  // handle_profile_deleted trigger promotes a new owner / voids obligations,
  // so the only thing not removed by deleteUser is the user's storage objects.
  try {
    // List the user's avatar folder and remove everything in it.
    const { data: files } = await admin.storage.from("avatars").list(userId, {
      limit: 1000,
    });
    const listedPaths = (files ?? []).map((f) => `${userId}/${f.name}`);
    // Also target the deterministic avatar paths in case listing misses them.
    const knownPaths = [
      `${userId}/avatar.jpg`,
      `${userId}/avatar.png`,
      `${userId}/avatar.webp`,
    ];
    const paths = Array.from(new Set([...listedPaths, ...knownPaths]));
    if (paths.length > 0) {
      await admin.storage.from("avatars").remove(paths);
    }
  } catch {
    // ignore — storage orphans don't block account deletion.
  }

  // Delete the auth user. Cascades through public.profiles, triggering the
  // promotion + obligation-voiding + notification cleanup we set up.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json(
      { error: "delete_failed", detail: error.message },
      { status: 500 }
    );
  }

  // Sign out the current session (it's now orphaned anyway).
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
