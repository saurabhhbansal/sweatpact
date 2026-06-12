import { redirect } from "next/navigation";
import { getAuthUser, getSupabaseRSC } from "@/lib/supabase/rsc";
import { SettingsForm } from "./client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = getSupabaseRSC();
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, onboarding_complete, name, email, gender, notify_unverified_checkin, notify_rest_day, notify_cycle_share")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  if (!profile.username || /^user_[a-f0-9]{8}$/.test(profile.username)) {
    redirect("/onboarding/username");
  }
  if (!profile.onboarding_complete) {
    redirect("/onboarding/schedule");
  }

  const { data: gyms } = await supabase
    .from("user_gyms")
    .select("id, name, address, lat, lng, radius_m, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: true });

  // People who have shared their cycle data with the current user, plus their
  // reminder preference. RLS grantee_read policy allows the authenticated user
  // to read rows where shared_with_id = auth.uid(), so no admin client needed.
  const { data: periodShares } = await supabase
    .from("period_sharing")
    .select("owner_id, notify_approaching, profiles:owner_id(username, name)")
    .eq("shared_with_id", profile.id);

  const sharesWithMe = (periodShares ?? []).map((row) => {
    const p = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as { username: string | null; name: string | null } | null;
    return {
      ownerId: row.owner_id as string,
      ownerUsername: p?.username ?? null,
      ownerName: p?.name ?? null,
      notifyApproaching: row.notify_approaching as boolean,
    };
  });

  return (
    <>
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        <section className="animate-fade-up-item rounded-[2rem] glass-card p-5">
          <div className="mb-5">
            <h1 className="text-base font-semibold text-white">Settings</h1>
            <p className="mt-1 text-sm text-white/55">Tune your accountability rules.</p>
          </div>
          <SettingsForm
            profile={profile}
            initialGyms={gyms ?? []}
            sharesWithMe={sharesWithMe}
          />
        </section>
      </main>
    </>
  );
}
