import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck2, Flame, MapPin, Moon, Target, User, Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDay, normalizeTimeZone } from "@/lib/time";
import { areUsersInSameChallenge, computeProfileStats } from "@/lib/stats";
import { computePeriodStats } from "@/lib/period-stats";
import { MobileNav, TopNav } from "@/components/nav";
import { ChallengeButton } from "./challenge-button";
import { AvatarUpload } from "./avatar-upload";
import { NameEditor } from "./name-editor";
import { UsernameEditor } from "./username-editor";
import { RestDaysPicker } from "./rest-days-picker";
import { WeeklyGoalPicker } from "./weekly-goal-picker";
import { GenderPicker } from "./gender-picker";
import { VisibilityToggle } from "./visibility-toggle";
import { CycleDataPopup } from "./cycle-popup";
import { CheckinStrip } from "@/components/checkin-strip";
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
  const joinedDay = localDay(new Date(profile.created_at), timezone);

  // daily_status has a self-only RLS policy and checkin_events requires
  // same-group membership, so viewing another user's profile with the
  // viewer's session returns empty rows. Use the admin client for non-owners,
  // matching the same pattern used for gym names below.
  const stats = canSeeStats
    ? await computeProfileStats(
        isOwner ? supabase : createAdminClient(),
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

  // Cycle-data sharing: a non-owner can view this profile's cycle data if the
  // owner has granted them access via period_sharing. The grantee_read RLS
  // policy lets the viewer read their own grant row.
  let canSeePeriod = isOwner;
  if (!canSeePeriod && profile.gender === "female") {
    const { data: share } = await supabase
      .from("period_sharing")
      .select("owner_id")
      .eq("owner_id", profile.id)
      .eq("shared_with_id", viewerProfile.id)
      .maybeSingle();
    canSeePeriod = share != null;
  }

  // Build the read-only cycle popup data for an authorised non-owner viewer.
  // Uses the admin client because viewer RLS doesn't cover another user's rows.
  let popupStats: ReturnType<typeof computePeriodStats> | null = null;
  let popupRecords: Array<{ local_day: string; flow_level: "light" | "medium" | "heavy" | "unspecified" }> = [];
  if (canSeePeriod && !isOwner && profile.gender === "female") {
    const admin = createAdminClient();
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    const { data } = await admin
      .from("period_records")
      .select("local_day, flow_level")
      .eq("user_id", profile.id)
      .gte("local_day", cutoffKey)
      .order("local_day", { ascending: true });
    popupRecords = data ?? [];
    popupStats = computePeriodStats(popupRecords, today);
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

        {popupStats ? (
          <CycleDataPopup
            stats={popupStats}
            records={popupRecords}
            today={today}
            targetName={displayName}
          />
        ) : null}

        {!canSeeStats ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <p className="text-base font-semibold text-white">Private profile</p>
            <p className="mt-1 text-sm text-white/55">
              This user keeps their stats private. Start a challenge together to see them.
            </p>
            <div className="mt-4 flex justify-center">
              <ChallengeButton
                targetUserId={profile.id}
                targetUsername={profile.username!}
                targetName={displayName}
              />
            </div>
          </section>
        ) : stats ? (
          <>
            <section aria-label="Stats" className="grid grid-cols-2 gap-3">
              <div className="col-span-2 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <div className="flex items-center gap-1.5 text-white/45">
                  <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                  <p className="text-xs uppercase tracking-[0.18em]">Week streak</p>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-5xl font-bold text-white">{stats.weekStreak}</p>
                  <p className="text-sm text-white/55">
                    consecutive week{stats.weekStreak === 1 ? "" : "s"} hitting goal
                  </p>
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                <div className="flex items-center gap-1.5 text-white/45">
                  <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <p className="text-[10px] uppercase tracking-[0.16em]">This week</p>
                </div>
                <p className="mt-2 text-2xl font-bold text-white">
                  {stats.thisWeekCheckins}
                  <span className="text-base font-medium text-white/35">/{stats.weeklyGoal}</span>
                </p>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={stats.weeklyGoal}
                  aria-valuenow={Math.min(stats.thisWeekCheckins, stats.weeklyGoal)}
                  aria-label={`${stats.thisWeekCheckins} of ${stats.weeklyGoal} days this week`}
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-full rounded-full bg-white"
                    style={{
                      width: `${Math.min(100, Math.round((stats.thisWeekCheckins / Math.max(1, stats.weeklyGoal)) * 100))}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-white/45">
                  {stats.thisWeekCheckins >= stats.weeklyGoal ? "goal met" : "days done"}
                </p>
              </div>

              <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                <div className="flex items-center gap-1.5 text-white/45">
                  <Users2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <p className="text-[10px] uppercase tracking-[0.16em]">Challenges</p>
                </div>
                <p className="mt-2 text-2xl font-bold text-white">{stats.challengesActive}</p>
                <p className="mt-1.5 text-[11px] text-white/45">active right now</p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-xl">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45">Activity</p>
              <CheckinStrip
                today={today}
                startDay={joinedDay}
                history={stats.history}
                restDays={Array.isArray(profile.rest_days) ? profile.rest_days : []}
              />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.08] pt-3 text-xs text-white/55">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500/90" aria-hidden="true" />
                  {stats.totalGymDays} gym
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-white/30" aria-hidden="true" />
                  {stats.totalRestDays + stats.totalExcusedDays} rest &amp; excused
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500/70" aria-hidden="true" />
                  {stats.totalMissedDays} missed
                </span>
              </div>
            </section>

            {gymNames.length > 0 ? (
              <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <div className="flex items-center gap-1.5 text-white/45">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  <p className="text-xs uppercase tracking-[0.18em]">Gyms</p>
                </div>
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
              </section>
            ) : null}

            {isOwner ? (
              <>
                <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                  <div className="flex items-center gap-1.5 text-white/45">
                    <Target className="h-3.5 w-3.5" aria-hidden="true" />
                    <p className="text-xs uppercase tracking-[0.18em]">Weekly goal</p>
                  </div>
                  <div className="mt-3">
                    <WeeklyGoalPicker
                      initialWeeklyGoal={profile.weekly_goal ?? 4}
                      restDaysCount={Array.isArray(profile.rest_days) ? profile.rest_days.length : 0}
                    />
                  </div>
                </section>

                <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                  <div className="flex items-center gap-1.5 text-white/45">
                    <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                    <p className="text-xs uppercase tracking-[0.18em]">Rest days</p>
                  </div>
                  <div className="mt-3">
                    <RestDaysPicker
                      initialRestDays={Array.isArray(profile.rest_days) ? profile.rest_days : []}
                      weeklyGoal={profile.weekly_goal ?? 4}
                    />
                  </div>
                </section>

                <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                  <div className="flex items-center gap-1.5 text-white/45">
                    <User className="h-3.5 w-3.5" aria-hidden="true" />
                    <p className="text-xs uppercase tracking-[0.18em]">Gender</p>
                  </div>
                  <div className="mt-3">
                    <GenderPicker
                      initialGender={(profile.gender as "male" | "female" | null) ?? null}
                    />
                  </div>
                </section>
              </>
            ) : null}

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

function PeriodStatsCard({
  stats,
}: {
  stats: {
    lastPeriodStart: string | null;
    daysSinceLastPeriodStart: number | null;
    averageCycleDays: number | null;
    averageDurationDays: number | null;
    cyclesSampled: number;
    nextPredictedStart: string | null;
    daysUntilPredicted: number | null;
  };
}) {
  if (stats.cyclesSampled === 0) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
        <p className="text-base font-semibold text-white">Period</p>
        <p className="mt-2 text-sm text-white/55">
          No period days logged yet. Log them on the{" "}
          <Link href="/cycle" className="underline hover:text-white">
            Cycle tab
          </Link>
          , or set up Apple Health sync in Settings → Period sync.
        </p>
      </section>
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
            {stats.daysSinceLastPeriodStart != null
              ? stats.daysSinceLastPeriodStart === 0
                ? "today"
                : `${stats.daysSinceLastPeriodStart} day${stats.daysSinceLastPeriodStart === 1 ? "" : "s"} ago`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/55">Next predicted</p>
          <p className="mt-1 text-base font-semibold text-white">
            {predictedLabel ?? "—"}
          </p>
          <p className="mt-0.5 text-xs text-white/45">
            {dueText ?? "needs 3 periods"}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/55">Avg cycle</p>
          <p className="mt-1 text-base font-semibold text-white">
            {stats.averageCycleDays != null ? `${stats.averageCycleDays} days` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-white/45">
            {stats.averageCycleDays == null ? "needs 3 periods" : `from ${stats.cyclesSampled} cycles`}
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
