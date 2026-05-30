import Link from "next/link";
import { redirect } from "next/navigation";
import { getMembership, isManagerRole, normalizeRelation } from "@/lib/groups";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { localDay, normalizeTimeZone } from "@/lib/time";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { MobileNav, TopNav } from "@/components/nav";
import { Avatar } from "@/components/avatar";
import {
  GroupManagerMenu,
  InviteSection,
  LeaveGroupButton,
  RemoveMemberButton,
  ReverseCheckinButton,
  UpdateMemberRoleButton,
} from "./client";
import { ObligationActions } from "./obligation-actions";

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

const statusRank: Record<string, number> = {
  verified: 6,
  sick_day: 5,
  gym_closed: 5,
  rest_day: 5,
  period_day: 5,
  unverified: 4,
  rejected: 3,
  pending: 0,
};

function betterStatus(next: string, current?: string) {
  if (!current) return next;
  return (statusRank[next] ?? 0) > (statusRank[current] ?? 0) ? next : current;
}

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
  ] = await Promise.all([
    supabase
      .from("group_members")
      .select("user_id, role, penalty_cents, profiles:user_id(id, name, email, username, avatar_url)")
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
  const memberSummaries = (members ?? []).map((member: any) => {
    const profileRow = normalizeRelation<MemberProfile>(member.profiles);
    const name =
      profileRow?.name?.trim() ||
      (profileRow?.username ? `@${profileRow.username}` : null) ||
      profileRow?.email ||
      "Unknown member";
    const username = profileRow?.username ?? null;
    const avatar_url = profileRow?.avatar_url ?? null;
    if (profileRow) memberMap.set(profileRow.id, profileRow);
    return {
      user_id: member.user_id,
      name,
      username,
      avatar_url,
      role: member.role,
      penalty_cents: member.penalty_cents,
    };
  });

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

  return (
    <>
      <TopNav name={profile.name || profile.email} username={profile.username} />
      <main className="animate-fade-up container max-w-md space-y-4 pb-28 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/groups" className="text-xs uppercase tracking-[0.18em] text-white/45">
              Challenges
            </Link>
            <h1 className="mt-1 text-3xl font-semibold text-white">{group.name}</h1>
            <p className="mt-1 text-sm text-white/58">
              {group.description || "Stakes are real. Show up or pay up."}
            </p>
          </div>
          {isManager ? (
            <GroupManagerMenu
              groupId={group.id}
              currentName={group.name}
              defaultPenaltyCents={group.default_penalty_cents}
              inviteCode={group.invite_code}
              checkinNotifications={group.checkin_notifications ?? true}
              isOwner={isOwner}
              members={memberSummaries}
            />
          ) : null}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Add to challenge</CardTitle>
                <CardDescription>Default stake {formatCents(group.default_penalty_cents)}</CardDescription>
              </div>
              <Badge variant={membership.role === "owner" ? "default" : membership.role === "admin" ? "secondary" : "muted"}>
                {membership.role}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <InviteSection groupId={group.id} defaultPenaltyCents={group.default_penalty_cents} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Members</CardTitle>
            <CardDescription>Today&apos;s standing for each member</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {memberSummaries.map((member) => {
              const todayStatus = todayStatusByUser.get(member.user_id) ?? "pending";
              const canRemove =
                isManager &&
                member.user_id !== profile.id &&
                member.role !== "owner" &&
                (isOwner || member.role !== "admin");

              return (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/7 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      url={member.avatar_url}
                      name={member.name}
                      username={member.username}
                      size="sm"
                    />
                    <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-white">{member.name}</p>
                      <Badge variant={member.role === "owner" ? "default" : member.role === "admin" ? "secondary" : "muted"}>
                        {member.role}
                      </Badge>
                    </div>
                    {member.username ? (
                      <Link
                        href={`/u/${member.username}`}
                        className="mt-1 inline-block truncate text-xs text-white/45 hover:text-white/70"
                      >
                        @{member.username}
                      </Link>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {isOwner && member.user_id !== profile.id ? (
                        <UpdateMemberRoleButton
                          groupId={group.id}
                          userId={member.user_id}
                          role={member.role}
                        />
                      ) : null}
                      {canRemove ? (
                        <RemoveMemberButton groupId={group.id} userId={member.user_id} name={member.name} />
                      ) : null}
                    </div>
                    </div>
                  </div>
                  <StatusBadge status={todayStatus} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Today&apos;s Check-ins</CardTitle>
            <CardDescription>Unverified check-ins can be reversed by managers right away.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(todayCheckins ?? []).length === 0 ? (
              <p className="text-sm text-white/55">No one has logged a check-in in this group yet today.</p>
            ) : (
              ((todayCheckins ?? []) as GroupCheckinRow[]).map((checkin) => (
                <div
                  key={checkin.id}
                  className="rounded-xl border border-white/12 bg-white/7 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{nameFor(checkin.user_id)}</p>
                        <span className="text-xs uppercase tracking-[0.16em] text-white/36">{checkin.source}</span>
                      </div>
                      <p className="mt-1 text-xs text-white/48">
                        {new Date(checkin.occurred_at).toLocaleString("en-IN", {
                          timeZone: normalizeTimeZone(profile.timezone),
                        })}
                      </p>
                      {checkin.distance_m != null ? (
                        <p className="mt-1 text-xs text-white/42">{Math.round(checkin.distance_m)} m from gym</p>
                      ) : null}
                    </div>
                    <StatusBadge status={checkin.status} />
                  </div>
                  {isManager && checkin.status === "unverified" ? (
                    <div className="mt-3">
                      <ReverseCheckinButton
                        groupId={group.id}
                        checkinId={checkin.id}
                        memberName={nameFor(checkin.user_id)}
                      />
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Balances</CardTitle>
            <CardDescription>
              {pendingObligations.length === 0
                ? "All settled up"
                : `${pendingObligations.length} outstanding`}
              {activeDisputes.length > 0 ? ` · ${activeDisputes.length} open disputes` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingObligations.length === 0 ? (
              <p className="text-sm text-white/55">No pending obligations in this group right now.</p>
            ) : (
              pendingObligations.map((agg) => {
                const isMine = agg.from_user === profile.id || agg.to_user === profile.id;
                return (
                  <div
                    key={`${agg.from_user}:${agg.to_user}`}
                    className="rounded-xl border border-white/12 bg-white/7 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-white">
                        <span className="font-medium">{nameFor(agg.from_user)}</span>
                        {" owes "}
                        <span className="font-medium">{nameFor(agg.to_user)}</span>
                        {" "}
                        <span className="font-semibold">{formatCents(agg.total_cents)}</span>
                      </div>
                    </div>
                    {agg.obligation_ids.length > 1 ? (
                      <p className="mt-1 text-xs text-white/40">{agg.obligation_ids.length} unpaid weeks</p>
                    ) : null}
                    {isMine ? (
                      <div className="mt-3">
                        <ObligationActions obligationIds={agg.obligation_ids} />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}

            {activeDisputes.length > 0 ? (
              <div className="space-y-2 border-t border-white/10 pt-3">
                {activeDisputes.map((dispute) => (
                  <div
                    key={dispute.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/7 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white">
                        {nameFor(dispute.raised_by)} · {dispute.target_type}
                      </p>
                      <p className="truncate text-xs text-white/45">{dispute.reason}</p>
                    </div>
                    <StatusBadge status={dispute.status} />
                  </div>
                ))}
              </div>
            ) : null}

            {(settlements ?? []).length > 0 ? (
              <details className="rounded-xl border border-white/12 bg-white/7 px-4 py-3">
                <summary className="cursor-pointer text-sm text-white/75">
                  Recent settlements ({settlements?.length ?? 0})
                </summary>
                <div className="mt-3 space-y-2">
                  {(settlements ?? []).map((settlement) => (
                    <div key={settlement.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-white/70">
                        {nameFor(settlement.marked_by)} settled {formatCents(settlement.amount_cents)}
                      </span>
                      <span className="text-white/40">
                        {new Date(settlement.settled_at).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </CardContent>
        </Card>

        {(() => {
          const allRows = (historyRows ?? []) as GroupCheckinRow[];
          // historyRows is already ordered by occurred_at desc, so the first
          // row we see for each user is their most recent one.
          const latestPerUser: GroupCheckinRow[] = [];
          const seenUsers = new Set<string>();
          for (const row of allRows) {
            if (seenUsers.has(row.user_id)) continue;
            seenUsers.add(row.user_id);
            latestPerUser.push(row);
          }
          const hasMore = allRows.length > latestPerUser.length;

          function renderRow(row: GroupCheckinRow) {
            return (
              <div
                key={row.id}
                className="flex items-start justify-between gap-3 rounded-[1.4rem] border border-white/12 bg-white/[0.04] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {nameFor(row.user_id)}
                    <span className="ml-2 text-xs uppercase tracking-[0.16em] text-white/35">
                      {row.source}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-white/46">
                    {new Date(row.occurred_at).toLocaleString("en-IN", {
                      timeZone: normalizeTimeZone(profile.timezone),
                    })}
                  </p>
                  {row.distance_m != null ? (
                    <p className="mt-1 text-xs text-white/42">{Math.round(row.distance_m)} m from gym</p>
                  ) : null}
                </div>
                <StatusBadge status={row.status} />
              </div>
            );
          }

          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Most recent status per member</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestPerUser.length === 0 ? (
                  <p className="text-sm text-white/55">No activity yet.</p>
                ) : (
                  <>
                    {latestPerUser.map(renderRow)}
                    {hasMore ? (
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-white/70 transition hover:bg-white/[0.06] hover:text-white">
                          <span className="group-open:hidden">Show all activity ({allRows.length})</span>
                          <span className="hidden group-open:inline">Hide full activity</span>
                        </summary>
                        <div className="mt-3 space-y-3">
                          {allRows
                            .filter((row) => !latestPerUser.includes(row))
                            .map(renderRow)}
                        </div>
                      </details>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })()}

        <div className="flex items-center justify-between gap-3 px-1">
          <Link href="/groups" className="text-sm text-white/55 transition hover:text-white">
            Back to all groups
          </Link>
          <LeaveGroupButton groupId={group.id} isOwner={isOwner} />
        </div>
      </main>
      <MobileNav />
    </>
  );
}
