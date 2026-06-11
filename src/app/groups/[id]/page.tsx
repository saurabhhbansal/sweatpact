import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMembership, isManagerRole, normalizeRelation } from "@/lib/groups";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { localDay, normalizeTimeZone } from "@/lib/time";
import { MobileNav, TopNav } from "@/components/nav";
import { AvatarStack } from "@/components/avatar";
import { betterStatus } from "@/lib/challenge-view";
import { GroupManagerMenu, LeaveGroupButton } from "./client";
import { MemberStatusAvatar, type MemberCheckin } from "./member-status";
import { LedgerButtons } from "./ledger";
import {
  GroupCheckinStrip,
  CalendarLegend,
  type CalendarMember,
} from "./group-checkin-strip";

export const dynamic = "force-dynamic";

type MemberProfile = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
};

type GroupCheckinRow = {
  id: string;
  submission_id: string;
  user_id: string;
  status: string;
  occurred_at: string;
  distance_m: number | null;
  source: string;
};

export default async function GroupPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, onboarding_complete, timezone, name, email")
    .eq("id", auth.user.id)
    .single();
  if (!profile) redirect("/login");
  if (!profile.username || /^user_[a-f0-9]{8}$/.test(profile.username)) {
    redirect("/onboarding/username");
  }
  if (!profile.onboarding_complete) {
    redirect("/onboarding/schedule");
  }

  const membership = await getMembership(supabase, auth.user.id, params.id);
  if (!membership || !membership.group) {
    redirect("/groups");
  }

  const group = membership.group;
  const today = localDay(new Date(), normalizeTimeZone(profile.timezone));
  const isOwner = membership.role === "owner";
  const isManager = isManagerRole(membership.role);

  const [
    { data: members },
    { data: todayCheckins },
    { data: obligations },
    { data: disputes },
    { data: historyRows },
    { data: calendarEvents },
  ] = await Promise.all([
    supabase
      .from("group_members")
      .select("user_id, role, penalty_cents, profiles:user_id(id, name, email, username, avatar_url, rest_days)")
      .eq("group_id", group.id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("checkin_events")
      .select("id, submission_id, user_id, status, occurred_at, distance_m, source")
      .eq("group_id", group.id)
      .eq("local_day", today)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("obligations")
      .select("id, from_user, to_user, amount_cents, status, created_at, note")
      .eq("group_id", group.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("disputes")
      .select("id, raised_by, target_type, target_id, status, reason, created_at")
      .eq("group_id", group.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("checkin_events")
      .select("id, submission_id, user_id, status, occurred_at, distance_m, source")
      .eq("group_id", group.id)
      .order("occurred_at", { ascending: false })
      .limit(40),
    supabase
      .from("checkin_events")
      .select("user_id, local_day, status")
      .eq("group_id", group.id)
      .gte("local_day", group.created_at.slice(0, 10))
      .lte("local_day", today)
      .order("local_day", { ascending: true })
      .limit(5_000),
  ]);

  const obligationIds = (obligations ?? []).map((obligation) => obligation.id);
  const { data: settlements } =
    obligationIds.length > 0
      ? await supabase
          .from("settlements")
          .select("id, obligation_id, amount_cents, settled_at, marked_by, note")
          .in("obligation_id", obligationIds)
          .order("settled_at", { ascending: false })
          .limit(20)
      : { data: [] as Array<{
          id: string;
          obligation_id: string;
          amount_cents: number;
          settled_at: string;
          marked_by: string;
          note: string | null;
        }> };

  const memberMap = new Map<string, MemberProfile>();
  const memberRestDays = new Map<string, number[]>();
  const memberSummaries = (members ?? []).map((member: any) => {
    const profileRow = normalizeRelation<MemberProfile & { rest_days?: number[] }>(member.profiles);
    const name =
      profileRow?.name?.trim() ||
      (profileRow?.username ? `@${profileRow.username}` : null) ||
      profileRow?.email ||
      "Unknown member";
    const username = profileRow?.username ?? null;
    const avatar_url = profileRow?.avatar_url ?? null;
    if (profileRow) {
      memberMap.set(profileRow.id, profileRow);
      memberRestDays.set(profileRow.id, Array.isArray(profileRow.rest_days) ? profileRow.rest_days : []);
    }
    return {
      user_id: member.user_id,
      name,
      username,
      avatar_url,
      role: member.role,
      penalty_cents: member.penalty_cents,
    };
  });

  // Build calendar data: local_day → userId → best status
  const calendarByDay: Record<string, Record<string, string>> = {};
  for (const ev of (calendarEvents ?? []) as { user_id: string; local_day: string; status: string }[]) {
    const dayMap = calendarByDay[ev.local_day] ?? {};
    dayMap[ev.user_id] = betterStatus(ev.status, dayMap[ev.user_id]);
    calendarByDay[ev.local_day] = dayMap;
  }

  // Calendar members: current user first, then others in join order.
  const calendarMembers: CalendarMember[] = [
    ...memberSummaries.filter((m) => m.user_id === profile.id),
    ...memberSummaries.filter((m) => m.user_id !== profile.id),
  ].map((m) => ({
    userId: m.user_id,
    name: m.name,
    restDays: memberRestDays.get(m.user_id) ?? [],
  }));

  const todayStatusByUser = new Map<string, string>();
  for (const checkin of (todayCheckins ?? []) as GroupCheckinRow[]) {
    todayStatusByUser.set(
      checkin.user_id,
      betterStatus(checkin.status, todayStatusByUser.get(checkin.user_id))
    );
  }

  function nameFor(userId: string) {
    const record = memberMap.get(userId);
    return (
      record?.name?.trim() ||
      (record?.username ? `@${record.username}` : null) ||
      record?.email ||
      "Unknown member"
    );
  }

  // Aggregate pending obligations by (from_user, to_user) pair, only for current members.
  type AggregatedObligation = {
    from_user: string;
    to_user: string;
    total_cents: number;
    obligation_ids: string[];
  };

  const aggregatedMap = new Map<string, AggregatedObligation>();
  for (const obligation of (obligations ?? []).filter((o) => o.status === "pending")) {
    if (!memberMap.has(obligation.from_user) || !memberMap.has(obligation.to_user)) continue;
    const key = `${obligation.from_user}:${obligation.to_user}`;
    const entry = aggregatedMap.get(key);
    if (entry) {
      entry.total_cents += obligation.amount_cents;
      entry.obligation_ids.push(obligation.id);
    } else {
      aggregatedMap.set(key, {
        from_user: obligation.from_user,
        to_user: obligation.to_user,
        total_cents: obligation.amount_cents,
        obligation_ids: [obligation.id],
      });
    }
  }
  const pendingObligations = [...aggregatedMap.values()];
  const activeDisputes = (disputes ?? []).filter((dispute) => dispute.status === "open");

  // ── Versus hero data ────────────────────────────────────────────────────
  const tz = normalizeTimeZone(profile.timezone);
  const meSummary = memberSummaries.find((m) => m.user_id === profile.id);
  const otherSummaries = memberSummaries.filter((m) => m.user_id !== profile.id);
  const isOneOnOne = memberSummaries.length === 2;
  const heroOther = otherSummaries[0];

  // Short standing line: who owes whom (1-on-1) or how many outstanding.
  let standing = "All settled up";
  if (pendingObligations.length > 0) {
    if (isOneOnOne && heroOther) {
      const iOwe = pendingObligations.find(
        (o) => o.from_user === profile.id && o.to_user === heroOther.user_id
      );
      const theyOwe = pendingObligations.find(
        (o) => o.from_user === heroOther.user_id && o.to_user === profile.id
      );
      if (iOwe) standing = `You owe ${formatCents(iOwe.total_cents)}`;
      else if (theyOwe) standing = `${heroOther.name} owes you ${formatCents(theyOwe.total_cents)}`;
      else standing = `${pendingObligations.length} outstanding`;
    } else {
      standing = `${pendingObligations.length} outstanding`;
    }
  }

  // Per-member today check-ins (drives the avatar-tap manage overlay).
  const checkinsByUser = new Map<string, MemberCheckin[]>();
  for (const c of (todayCheckins ?? []) as GroupCheckinRow[]) {
    const arr = checkinsByUser.get(c.user_id) ?? [];
    arr.push({
      id: c.id,
      status: c.status,
      occurredLabel: new Date(c.occurred_at).toLocaleString("en-IN", { timeZone: tz }),
    });
    checkinsByUser.set(c.user_id, arr);
  }

  const viewerUserId = profile.id;
  function canManageMember(role: string, userId: string) {
    return (
      isManager &&
      userId !== viewerUserId &&
      role !== "owner" &&
      (isOwner || role !== "admin")
    );
  }

  // ── Serialized props for the Balances / Recent activity overlays ──────────
  const balanceRows = pendingObligations.map((agg) => ({
    fromName: nameFor(agg.from_user),
    toName: nameFor(agg.to_user),
    totalCents: agg.total_cents,
    obligationIds: agg.obligation_ids,
    isMine: agg.from_user === profile.id || agg.to_user === profile.id,
    weeks: agg.obligation_ids.length,
  }));
  const disputeRows = activeDisputes.map((d) => ({
    raisedByName: nameFor(d.raised_by),
    targetType: d.target_type,
    reason: d.reason,
  }));
  const settlementRows = (settlements ?? []).map((s) => ({
    markedByName: nameFor(s.marked_by),
    amountLabel: formatCents(s.amount_cents),
    dateLabel: new Date(s.settled_at).toLocaleDateString("en-IN"),
  }));
  const activityRows = ((historyRows ?? []) as GroupCheckinRow[]).map((row) => ({
    id: row.id,
    name: nameFor(row.user_id),
    source: row.source,
    timeLabel: new Date(row.occurred_at).toLocaleString("en-IN", { timeZone: tz }),
    status: row.status,
    distanceM: row.distance_m,
  }));

  return (
    <>
      <TopNav name={profile.name || profile.email} username={profile.username} />
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        <div className="animate-fade-up-item flex items-center justify-between">
          <Link href="/groups" className="text-xs uppercase tracking-[0.18em] text-white/45">
            ← Challenges
          </Link>
          {isManager ? (
            <GroupManagerMenu
              groupId={group.id}
              defaultPenaltyCents={group.default_penalty_cents}
              inviteCode={group.invite_code}
              checkinNotifications={group.checkin_notifications ?? true}
              isOwner={isOwner}
              members={memberSummaries}
            />
          ) : null}
        </div>

        {/* Versus hero */}
        <section
          className="animate-fade-up-item rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
          style={{ "--stagger": "50ms" } as React.CSSProperties}
        >
          <div className="flex items-stretch justify-between gap-2">
            {/* Me */}
            <div className="flex flex-1 justify-center">
              <MemberStatusAvatar
                userId={profile.id}
                member={{
                  name: meSummary?.name ?? "You",
                  username: meSummary?.username ?? null,
                  avatar_url: meSummary?.avatar_url ?? null,
                }}
                status={todayStatusByUser.get(profile.id) ?? "pending"}
                size="lg"
                groupId={group.id}
                isManager={isManager}
                isOwner={isOwner}
                isSelf
                canRemove={false}
                role={membership.role}
                checkins={checkinsByUser.get(profile.id) ?? []}
              />
            </div>

            {/* Center */}
            <div className="flex shrink-0 items-center px-1">
              <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
                {isOneOnOne ? "VS" : "with"}
              </span>
            </div>

            {/* Them */}
            <div className="flex flex-1 justify-center">
              {isOneOnOne && heroOther ? (
                <MemberStatusAvatar
                  userId={heroOther.user_id}
                  member={{
                    name: heroOther.name,
                    username: heroOther.username,
                    avatar_url: heroOther.avatar_url,
                  }}
                  status={todayStatusByUser.get(heroOther.user_id) ?? "pending"}
                  size="lg"
                  groupId={group.id}
                  isManager={isManager}
                  isOwner={isOwner}
                  isSelf={false}
                  canRemove={canManageMember(heroOther.role, heroOther.user_id)}
                  role={heroOther.role}
                  checkins={checkinsByUser.get(heroOther.user_id) ?? []}
                />
              ) : (
                <div className="flex flex-col items-center">
                  <AvatarStack
                    members={otherSummaries.map((m) => ({
                      url: m.avatar_url,
                      name: m.name,
                      username: m.username,
                    }))}
                    size="md"
                    max={3}
                  />
                  <p className="mt-2 text-sm font-semibold text-white">
                    {otherSummaries.length} other{otherSummaries.length === 1 ? "" : "s"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5">
            <GroupCheckinStrip
              today={today}
              startDay={group.created_at.slice(0, 10)}
              members={calendarMembers}
              calendarData={calendarByDay}
            />
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
            <div>
              <p className="text-xs text-white/45">Stake</p>
              <p className="text-sm font-semibold text-white">
                {formatCents(group.default_penalty_cents)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/45">Standing</p>
              <p className="text-sm font-semibold text-white">{standing}</p>
            </div>
          </div>
        </section>

        {/* Balances + Recent activity overlays */}
        <div className="animate-fade-up-item" style={{ "--stagger": "110ms" } as React.CSSProperties}>
          <LedgerButtons
            balances={balanceRows}
            disputes={disputeRows}
            settlements={settlementRows}
            activity={activityRows}
          />
        </div>

        {/* Calendar colour key */}
        <div className="animate-fade-up-item" style={{ "--stagger": "160ms" } as React.CSSProperties}>
          <CalendarLegend />
        </div>

        {/* Members — only for 3+ challenges (1-on-1 status lives in the hero) */}
        {memberSummaries.length > 2 ? (
          <section
            className="animate-fade-up-item rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl"
            style={{ "--stagger": "200ms" } as React.CSSProperties}
          >
            <p className="mb-4 text-xs uppercase tracking-[0.18em] text-white/45">Members</p>
            <div className="flex flex-wrap gap-5">
              {memberSummaries.map((member) => (
                <MemberStatusAvatar
                  key={member.user_id}
                  userId={member.user_id}
                  member={{
                    name: member.name,
                    username: member.username,
                    avatar_url: member.avatar_url,
                  }}
                  status={todayStatusByUser.get(member.user_id) ?? "pending"}
                  size="md"
                  groupId={group.id}
                  isManager={isManager}
                  isOwner={isOwner}
                  isSelf={member.user_id === profile.id}
                  canRemove={canManageMember(member.role, member.user_id)}
                  role={member.role}
                  checkins={checkinsByUser.get(member.user_id) ?? []}
                />
              ))}
            </div>
          </section>
        ) : null}

        <div
          className="animate-fade-up-item flex items-center justify-between gap-3 px-1"
          style={{ "--stagger": "240ms" } as React.CSSProperties}
        >
          <Link href="/groups" className="text-sm text-white/55 transition hover:text-white">
            Back to all groups
          </Link>
          <LeaveGroupButton groupId={group.id} isOwner={isOwner} />
        </div>
      </main>
      <MobileNav username={profile.username ?? undefined} />
    </>
  );
}
