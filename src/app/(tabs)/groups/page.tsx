import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listUserMemberships, normalizeRelation } from "@/lib/groups";
import { betterStatus } from "@/lib/challenge-view";
import { getSupabaseRSC, getViewerProfile, getOnboardingProgress } from "@/lib/supabase/rsc";
import { localDay, normalizeTimeZone } from "@/lib/time";
import { formatCents } from "@/lib/money";
import { UserSearch } from "@/components/user-search";
import { ChallengeVersusCard, type VersusPerson } from "@/components/challenge-versus-card";
import { PactLiveOverlay } from "@/components/pact-live-overlay";

export const dynamic = "force-dynamic";

type MemberProfileRow = {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function displayName(p: MemberProfileRow | null): string {
  return (
    p?.name?.trim() ||
    (p?.username ? `@${p.username}` : null) ||
    "Unknown"
  );
}

export default async function ChallengesPage() {
  const supa = getSupabaseRSC();

  const profile = await getViewerProfile();

  if (!profile) redirect("/login");

  const today = localDay(new Date(), normalizeTimeZone(profile.timezone));
  const memberships = await listUserMemberships(supa, profile.id);
  const groupIds = memberships.map((m) => m.group_id);

  const [
    { data: memberRows },
    { data: todayCheckins },
    { data: pendingInvites },
    { data: pendingObligations },
  ] = await Promise.all([
    groupIds.length > 0
      ? supa
          .from("group_members")
          .select("group_id, user_id, profiles:user_id(id, name, username, avatar_url)")
          .in("group_id", groupIds)
      : Promise.resolve({ data: [] as any[] }),
    groupIds.length > 0
      ? supa
          .from("checkin_events")
          .select("group_id, user_id, status")
          .in("group_id", groupIds)
          .eq("local_day", today)
      : Promise.resolve({ data: [] as any[] }),
    supa
      .from("challenge_invitations")
      .select("id")
      .eq("to_user", profile.id)
      .eq("status", "pending"),
    groupIds.length > 0
      ? supa
          .from("obligations")
          .select("group_id, from_user, to_user, amount_cents")
          .in("group_id", groupIds)
          .eq("status", "pending")
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // group_id → (user_id → profile)
  const membersByGroup = new Map<string, Map<string, MemberProfileRow>>();
  for (const row of (memberRows ?? []) as any[]) {
    const p = normalizeRelation<MemberProfileRow>(row.profiles);
    if (!p) continue;
    if (!membersByGroup.has(row.group_id)) membersByGroup.set(row.group_id, new Map());
    membersByGroup.get(row.group_id)!.set(row.user_id, p);
  }

  // group_id → (user_id → best today status)
  const statusByGroupUser = new Map<string, Map<string, string>>();
  for (const row of (todayCheckins ?? []) as any[]) {
    if (!statusByGroupUser.has(row.group_id)) statusByGroupUser.set(row.group_id, new Map());
    const inner = statusByGroupUser.get(row.group_id)!;
    inner.set(row.user_id, betterStatus(row.status, inner.get(row.user_id)));
  }

  // group_id → standing from the current user's perspective.
  // Aggregate individual obligation rows by (from_user|to_user) pair first, then
  // derive standing — matching the detail page's aggregation approach.
  type Standing = { text: string; tone: "positive" | "negative" | "neutral" };
  const standingByGroup = new Map<string, Standing>();

  // group_id → ("fromUser|toUser" → summed cents)
  const oblByGroup = new Map<string, Map<string, number>>();
  for (const obl of (pendingObligations ?? []) as any[]) {
    if (!oblByGroup.has(obl.group_id)) oblByGroup.set(obl.group_id, new Map());
    const pairKey = `${obl.from_user}|${obl.to_user}`;
    const inner = oblByGroup.get(obl.group_id)!;
    inner.set(pairKey, (inner.get(pairKey) ?? 0) + Number(obl.amount_cents));
  }

  for (const [gid, pairs] of oblByGroup.entries()) {
    let iOweCents = 0;
    let theyOweCents = 0;
    let otherPairCount = 0;
    for (const [pairKey, cents] of pairs.entries()) {
      const [fromUser, toUser] = pairKey.split("|");
      if (fromUser === profile.id) {
        iOweCents += cents;
      } else if (toUser === profile.id) {
        theyOweCents += cents;
      } else {
        otherPairCount++;
      }
    }
    if (iOweCents > 0) {
      standingByGroup.set(gid, { text: `You owe ${formatCents(iOweCents)}`, tone: "negative" });
    } else if (theyOweCents > 0) {
      standingByGroup.set(gid, { text: `Owes you ${formatCents(theyOweCents)}`, tone: "positive" });
    } else if (otherPairCount > 0) {
      standingByGroup.set(gid, { text: `${otherPairCount} outstanding`, tone: "neutral" });
    }
  }

  const pendingCount = pendingInvites?.length ?? 0;

  // A challenge only becomes real once someone accepts. The invite flow creates
  // the group with just the inviter, so a pending (or abandoned) challenge has a
  // single member — hide those so the list shows only challenges with an actual
  // opponent. Pending sent invites still live in the notifications overlay.
  const activeMemberships = memberships.filter(
    (m) => (membersByGroup.get(m.group_id)?.size ?? 0) >= 2
  );

  // Request-cached read (shares the request's auth round trip) — null for users
  // with no row. Drives the shown-once "Pact is live" overlay (UX-03, D-03).
  const progress = await getOnboardingProgress();
  const completedSteps = progress?.completed_steps ?? [];

  return (
    <>
      <main
        className="container max-w-md space-y-5 pb-28 pt-4"
        data-tour="money"
        data-pending-count={pendingCount}
      >
        <div className="animate-fade-up-item">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Challenges</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Your active bets</h1>
        </div>

        {/* Pending invitations — slim banner, shown before the list so it requires action */}
        {pendingCount > 0 ? (
          <Link
            href="/notifications"
            className="animate-fade-up-item flex items-center justify-between gap-3 rounded-full border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white transition hover:bg-white/[0.1]"
            style={{ "--stagger": "50ms" } as React.CSSProperties}
          >
            <span>
              {pendingCount} pending challenge{pendingCount === 1 ? "" : "s"}
            </span>
            <span className="text-xs uppercase tracking-[0.14em] text-white/55">Review</span>
          </Link>
        ) : null}

        {/* Challenge versus cards — primary daily view */}
        <div className="space-y-3">
          {activeMemberships.length === 0 ? (
            <div
              className="animate-fade-up-item rounded-[2rem] glass-card p-6 text-center"
              style={{ "--stagger": "50ms" } as React.CSSProperties}
            >
              <p className="text-base font-semibold text-white">No challenges yet</p>
              <p className="mt-2 text-sm text-white/55">
                Search below to challenge a friend. Once they accept, the stakes start.
              </p>
            </div>
          ) : (
            activeMemberships.map((membership, index) => {
              if (!membership.group) return null;
              const memberMap = membersByGroup.get(membership.group_id) ?? new Map();
              const statusMap = statusByGroupUser.get(membership.group_id) ?? new Map();

              const me: VersusPerson = {
                url: profile.avatar_url,
                name: profile.name || "You",
                username: profile.username,
                status: statusMap.get(profile.id),
              };
              const others: VersusPerson[] = [...memberMap.entries()]
                .filter(([userId]) => userId !== profile.id)
                .map(([userId, p]) => ({
                  url: p.avatar_url,
                  name: displayName(p),
                  username: p.username,
                  status: statusMap.get(userId),
                }));

              const totalMembers = memberMap.size || others.length + 1;

              return (
                <div
                  key={membership.group_id}
                  className="animate-fade-up-item"
                  style={{ "--stagger": `${Math.min(50 + index * 60, 350)}ms` } as React.CSSProperties}
                >
                  <ChallengeVersusCard
                    challengeId={membership.group_id}
                    stakeCents={membership.group.default_penalty_cents}
                    me={me}
                    others={others}
                    isOneOnOne={totalMembers === 2}
                    standing={standingByGroup.get(membership.group_id)}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* New-challenge search — below the daily view */}
        <section
          data-tour="challenge"
          className="animate-fade-up-item rounded-[1.7rem] glass-card p-4"
          style={{ "--stagger": "150ms" } as React.CSSProperties}
        >
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">
            Challenge someone new
          </p>
          <UserSearch />
        </section>
      </main>

      {/* Phase 6 — fires once when the viewer's first challenge goes active */}
      <PactLiveOverlay
        hasActiveChallenge={activeMemberships.length > 0}
        completedSteps={completedSteps}
      />
    </>
  );
}
