import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MobileNav, TopNav } from "@/components/nav";
import { SettingsForm } from "./client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
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
  // reminder preference. Uses admin client — RLS only allows reading own rows.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: periodShares } = await admin
    .from("period_sharing")
    .select("owner_id, notify_approaching, profiles:owner_id(username, name)")
    .eq("shared_with_id", profile.id);

  const sharesWithMe = (periodShares ?? []).map((row) => {
    const p = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as { username: string | null; name: string | null } | null;
    return {
      ownerUsername: p?.username ?? null,
      ownerName: p?.name ?? null,
      notifyApproaching: row.notify_approaching as boolean,
    };
  });

  return (
    <>
      <TopNav name={profile.name || profile.email} username={profile.username} />
      <main className="animate-fade-up container max-w-md space-y-4 pb-28 pt-4">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Tune your accountability rules.</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm
              profile={profile}
              initialGyms={gyms ?? []}
              sharesWithMe={sharesWithMe}
            />
          </CardContent>
        </Card>
      </main>
      <MobileNav />
    </>
  );
}
