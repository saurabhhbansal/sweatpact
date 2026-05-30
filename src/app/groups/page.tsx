import Link from "next/link";
import { redirect } from "next/navigation";
import { listUserMemberships } from "@/lib/groups";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MobileNav, TopNav } from "@/components/nav";
import { UserSearch } from "@/components/user-search";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
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

  const memberships = await listUserMemberships(supabase, auth.user.id);

  const { data: pendingInvites } = await supabase
    .from("challenge_invitations")
    .select("id, group_id, from_user, penalty_cents, message, created_at")
    .eq("to_user", profile.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <>
      <TopNav name={profile.name || profile.email} username={profile.username} />
      <main className="animate-fade-up container max-w-md space-y-4 pb-28 pt-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Challenges</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Your active bets</h1>
          <p className="mt-2 text-sm text-white/58">
            Search for someone, send a challenge, then keep each other honest.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Find someone to challenge</CardTitle>
            <CardDescription>Look them up by username or name.</CardDescription>
          </CardHeader>
          <CardContent>
            <UserSearch />
          </CardContent>
        </Card>

        {pendingInvites && pendingInvites.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Pending invitations</CardTitle>
              <CardDescription>
                You have {pendingInvites.length} unanswered challenge
                {pendingInvites.length === 1 ? "" : "s"}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/notifications"
                className="inline-block rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90"
              >
                Review invitations
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-3">
          {memberships.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No challenges yet</CardTitle>
                <CardDescription>
                  Challenge a friend above. Once they accept, the stakes start.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            memberships.map((membership) => {
              if (!membership.group) return null;
              return (
                <Link key={membership.group_id} href={`/groups/${membership.group_id}`} className="block">
                  <Card className="transition duration-200 hover:bg-white/12">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle>{membership.group.name}</CardTitle>
                          <CardDescription className="mt-2">
                            {membership.group.description || "No description yet"}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={
                            membership.role === "owner"
                              ? "default"
                              : membership.role === "admin"
                                ? "secondary"
                                : "muted"
                          }
                        >
                          {membership.role}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between pt-0">
                      <p className="text-sm text-white/72">
                        Default stake {formatCents(membership.group.default_penalty_cents)}
                      </p>
                      <p className="text-xs uppercase tracking-[0.16em] text-white/35">Open</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </main>
      <MobileNav />
    </>
  );
}
