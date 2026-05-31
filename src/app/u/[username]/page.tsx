import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDay, normalizeTimeZone } from "@/lib/time";
import { areUsersInSameChallenge, computeProfileStats } from "@/lib/stats";
import { computePeriodStats } from "@/lib/period-stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileNav, TopNav } from "@/components/nav";
import { ChallengeButton } from "./challenge-button";
import { AvatarUpload } from "./avatar-upload";
import { NameEditor } from "./name-editor";
import { UsernameEditor } from "./username-editor";
import { RestDaysPicker } from "./rest-days-picker";
import { WeeklyGoalPicker } from "./weekly-goal-picker";
import { VisibilityToggle } from "./visibility-toggle";
import { Avatar } from "@/components/avatar";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("id, name, email, username, timezone, onboarding_complete")
    .eq("id", auth.user.id)
    .single();
  if (!viewerProfile) redirect("/login");

  if (!viewerProfile.username || /^user_[a-f0-9]{8}$/.test(viewerProfile.username)) {
    redirect("/onboarding/username");
  }
  if (!viewerProfile.onboarding_complete) {
    redirect("/onboarding/schedule");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, name, username, profile_visibility, avatar_url, timezone, weekly_goal, rest_days, gender, created_at"
    )
    .ilike("username", params.username)
    .maybeSingle();

  if (!profile) notFound();

  const isOwner = profile.id === viewerProfile.id;
  const isPrivate = profile.profile_visibility === "private";

  let canSeeStats = true;
  if (!isOwner && isPrivate) {
    canSeeStats = await areUsersInSameChallenge(supabase, profile.id, viewerProfile.id);
  }

  const timezone = normalizeTimeZone(profile.timezone);
  const today = localDay(new Date(), timezone);

  const stats = canSeeStats
    ? await computeProfileStats(
        supabase,
        profile.id,
        today,
        profile.weekly_goal ?? 4,
        profile.created_at
      )
    : null;

  // Period stats are owner-only and gender-gated. Fetch the last ~6 months.
  let periodStats: ReturnType<typeof computePeriodStats> | null = null;
  if (isOwner && profile.gender === "female") {
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    const { data: periodRecords } = await supabase
      .from("period_records")
      .select("local_day, flow_level")
      .eq("user_id", profile.id)
      .gte("local_day", cutoffKey)
      .order("local_day", { ascending: true });
    periodStats = computePeriodStats(periodRecords ?? [], today);
  }

  // Gym names — visible to anyone who can see stats (owner + challenge partners).
  // Uses admin client since viewer-scoped RLS only covers the viewer's own gyms.
  let gymNames: string[] = [];
  if (canSeeStats) {
    const admin = createAdminClient();
    const { data: gyms } = await admin
      .from("user_gyms")
      .select("name")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: true });
    gymNames = (gyms ?? []).map((g) => g.name);
  }

  const displayName = profile.name?.trim() || `@${profile.username}`;
  const joinedDate = new Date(profile.created_at).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <TopNav name={viewerProfile.name || viewerProfile.email} username={viewerProfile.username} />
      <main className="animate-fade-up container max-w-md space-y-4 pb-28 pt-4">
        <section className="flex flex-col items-center rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-xl">
          {isOwner ? (
            <AvatarUpload
              userId={profile.id}
              username={profile.username}
              name={profile.name}
              initialUrl={profile.avatar_url}
            />
          ) : (
            <Avatar
              url={profile.avatar_url}
              name={profile.name}
              username={profile.username}
              size="lg"
            />
          )}
          {isOwner ? (
            <>
              <div className="mt-4">
                <NameEditor currentName={profile.name ?? ""} />
              </div>
              <div className="mt-1">
                <UsernameEditor currentUsername={profile.username!} />
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-2xl font-semibold text-white">{displayName}</h1>
              <p className="mt-1 text-sm text-white/55">@{profile.username}</p>
            </>
          )}
          <p className="mt-1 text-xs text-white/40">Joined {joinedDate}</p>

          {!isOwner && canSeeStats ? (
            <div className="mt-4">
              <ChallengeButton
                targetUserId={profile.id}
                targetUsername={profile.username!}
                targetName={displayName}
              />
            </div>
          ) : null}
        </section>

        {!canSeeStats ? (
          <Card>
            <CardHeader>
              <CardTitle>Private profile</CardTitle>
              <CardDescription>
                This user keeps their stats private. Start a challenge together to see them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChallengeButton
                targetUserId={profile.id}
                targetUsername={profile.username!}
                targetName={displayName}
              />
            </CardContent>
          </Card>
        ) : stats ? (
          <>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Week streak</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-5xl font-bold text-white">{stats.weekStreak}</p>
                <p className="text-sm text-white/55">
                  consecutive week{stats.weekStreak === 1 ? "" : "s"} hitting goal
                </p>
              </div>
              <p className="mt-3 text-xs text-white/50">
                This week: {stats.thisWeekCheckins} / {stats.weeklyGoal} days &middot; goal {stats.weeklyGoal}d/week
              </p>
              {gymNames.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {gymNames.map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-white/20 bg-white/[0.06] px-2.5 py-1 text-xs text-white/70"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Gym days" value={stats.totalGymDays} />
              <RestDaysTile restDays={Array.isArray(profile.rest_days) ? profile.rest_days : []} />
              <StatTile label="Excused" value={stats.totalExcusedDays} />
              <StatTile label="Missed" value={stats.totalMissedDays} />
            </div>

            {isOwner ? (
              <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Weekly goal</p>
                <p className="mt-1 text-xs text-white/50">
                  Days per week you aim to check in. Penalties apply when you fall short.
                </p>
                <div className="mt-3">
                  <WeeklyGoalPicker
                    initialWeeklyGoal={profile.weekly_goal ?? 4}
                    restDaysCount={Array.isArray(profile.rest_days) ? profile.rest_days.length : 0}
                  />
                </div>
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-white/45">Rest days</p>
                <p className="mt-1 text-xs text-white/50">
                  Days marked rest are automatically excused — no check-in needed.
                </p>
                <div className="mt-3">
                  <RestDaysPicker
                    initialRestDays={Array.isArray(profile.rest_days) ? profile.rest_days : []}
                    weeklyGoal={profile.weekly_goal ?? 4}
                  />
                </div>
              </section>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Active challenges</CardTitle>
                <CardDescription>
                  In {stats.challengesActive} challenge{stats.challengesActive === 1 ? "" : "s"} right now.
                </CardDescription>
              </CardHeader>
            </Card>

            {periodStats ? <PeriodStatsCard stats={periodStats} /> : null}

            {isOwner ? (
              <VisibilityToggle
                initial={(profile.profile_visibility as "public" | "private") ?? "public"}
              />
            ) : null}
          </>
        ) : null}
      </main>
      <MobileNav />
    </>
  );
}

const DOW_LABELS: Record<number, string> = {
  1: "Mo",
  2: "Tu",
  3: "We",
  4: "Th",
  5: "Fr",
  6: "Sa",
  0: "Su",
};
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

function RestDaysTile({ restDays }: { restDays: number[] }) {
  const sorted = DOW_ORDER.filter((d) => restDays.includes(d));
  return (
    <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.14em] text-white/55">Rest days</p>
      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-white/45">None scheduled</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          {sorted.map((d) => (
            <span
              key={d}
              className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border border-white/30 bg-white/[0.08] px-2 text-xs font-semibold text-white"
            >
              {DOW_LABELS[d]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.14em] text-white/55">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function PeriodStatsCard({
  stats,
}: {
  stats: {
    lastPeriodStart: string | null;
    daysSinceLastPeriod: number | null;
    averageCycleDays: number | null;
    averageDurationDays: number | null;
    cyclesSampled: number;
    nextPredictedStart: string | null;
    daysUntilPredicted: number | null;
  };
}) {
  if (stats.cyclesSampled === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Period</CardTitle>
          <CardDescription>
            No period days logged yet. Log them on the{" "}
            <Link href="/cycle" className="underline hover:text-white">
              Cycle tab
            </Link>
            , or set up Apple Health sync in Settings → Period sync.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const startLabel = stats.lastPeriodStart
    ? new Date(stats.lastPeriodStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "—";

  const predictedLabel = stats.nextPredictedStart
    ? new Date(stats.nextPredictedStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;
  const dueText =
    stats.daysUntilPredicted == null
      ? null
      : stats.daysUntilPredicted < -1
        ? `${Math.abs(stats.daysUntilPredicted)} days late`
        : stats.daysUntilPredicted === -1
          ? "1 day late"
          : stats.daysUntilPredicted === 0
            ? "due today"
            : stats.daysUntilPredicted === 1
              ? "due tomorrow"
              : `in ${stats.daysUntilPredicted} days`;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">Period</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-white/55">Last started</p>
          <p className="mt-1 text-base font-semibold text-white">
            {startLabel}
          </p>
          <p className="mt-0.5 text-xs text-white/45">
            {stats.daysSinceLastPeriod != null
              ? stats.daysSinceLastPeriod === 0
                ? "today"
                : `${stats.daysSinceLastPeriod} day${stats.daysSinceLastPeriod === 1 ? "" : "s"} ago`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/55">Next predicted</p>
          <p className="mt-1 text-base font-semibold text-white">
            {predictedLabel ?? "—"}
          </p>
          <p className="mt-0.5 text-xs text-white/45">
            {dueText ?? "needs 2+ cycles"}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/55">Avg cycle</p>
          <p className="mt-1 text-base font-semibold text-white">
            {stats.averageCycleDays != null ? `${stats.averageCycleDays} days` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-white/45">
            {stats.averageCycleDays == null ? "needs 2+ cycles" : `from ${stats.cyclesSampled} cycles`}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/55">Avg duration</p>
          <p className="mt-1 text-base font-semibold text-white">
            {stats.averageDurationDays != null ? `${stats.averageDurationDays} days` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-white/45">{stats.cyclesSampled} cycles, last 6 mo</p>
        </div>
      </div>
      <Link
        href="/cycle"
        className="mt-4 inline-block text-xs text-white/55 underline transition hover:text-white"
      >
        View full cycle details →
      </Link>
    </section>
  );
}
