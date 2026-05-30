import Link from "next/link";
import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MobileNav, TopNav } from "@/components/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationsList, SentInvitations } from "./client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, username, onboarding_complete")
    .eq("id", auth.user.id)
    .single();
  if (!profile) redirect("/login");
  if (!profile.username || /^user_[a-f0-9]{8}$/.test(profile.username)) {
    redirect("/onboarding/username");
  }
  if (!profile.onboarding_complete) {
    redirect("/onboarding/schedule");
  }

  const [{ data: notifications }, { data: sentInvitations }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, payload, read_at, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("challenge_invitations")
      .select("id, to_user, penalty_cents, message, created_at")
      .eq("from_user", profile.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  // Resolve recipient names/usernames for sent invitations.
  const toIds = (sentInvitations ?? []).map((i) => i.to_user);
  const { data: targets } = toIds.length
    ? await supabase
        .from("profiles")
        .select("id, name, username")
        .in("id", toIds)
    : { data: [] };
  const sentWithTarget = (sentInvitations ?? []).map((inv) => {
    const t = (targets ?? []).find((p) => p.id === inv.to_user);
    return {
      id: inv.id,
      to_user: inv.to_user,
      to_username: t?.username ?? null,
      to_name: t?.name ?? null,
      penalty_cents: inv.penalty_cents,
      message: inv.message,
      created_at: inv.created_at,
    };
  });

  return (
    <>
      <TopNav name={profile.name || profile.email} username={profile.username} />
      <main className="animate-fade-up container max-w-md space-y-4 pb-28 pt-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  {(notifications ?? []).length === 0
                    ? "Nothing here yet."
                    : "Tap accept or decline to respond to challenges."}
                </CardDescription>
              </div>
              <Link
                href="/dashboard"
                aria-label="Close notifications"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-transparent text-white/70 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <NotificationsList initial={notifications ?? []} />
          </CardContent>
        </Card>

        {sentWithTarget.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Sent challenges</CardTitle>
              <CardDescription>
                Pending invitations you sent. Cancel to withdraw.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SentInvitations initial={sentWithTarget} />
            </CardContent>
          </Card>
        ) : null}
      </main>
      <MobileNav />
    </>
  );
}
