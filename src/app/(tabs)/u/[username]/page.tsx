import type React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck2, Flame, MapPin, Moon, Target, User } from "lucide-react";
import { getSupabaseRSC, getViewerProfile } from "@/lib/supabase/rsc";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDay, normalizeTimeZone } from "@/lib/time";
import { areUsersInSameChallenge, computeProfileStats } from "@/lib/stats";
import { computePeriodStats } from "@/lib/period-stats";
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
  const supabase = getSupabaseRSC();

  // Viewer profile is request-cached (shared with the (tabs) layout); the
  // target profile is the only DB hit unique to this page.
  const [viewerProfile, { data: profile }] = await Promise.all([
    getViewerProfile(),
    supabase
      .from("profiles")
      .select(
        "id, name, username, profile_visibility, avatar_url, timezone, weekly_goal, rest_days, gender, created_at"
      )
      .ilike("username", params.username)
      .maybeSingle(),
  ]);

  if (!viewerProfile) redirect("/login");

  if (!viewerProfile.username || /^user_[a-f0-9]{8}$/.test(viewerProfile.username)) {
    redirect("/onboarding/username");
  }
  if (!viewerProfile.onboarding_complete) {
    redirect("/onboarding/schedule");
  }

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

  // Fetch stats, gym names, and period-sharing permission in parallel — they
  // all depend only on canSeeStats / profile fields already resolved above.
  const [stats, gymNames, periodShareRow] = await Promise.all([
    // daily_status has a self-only RLS policy and checkin_events requires
    // same-group membership, so viewing another user's profile with the
    // viewer's session returns empty rows. Use the admin client for non-owners.
    canSeeStats
      ? computeProfileStats(
          isOwner ? supabase : createAdminClient(),
          profile.id,
          today,
          profile.weekly_goal ?? 4,
          profile.created_at
        )
      : Promise.resolve(null),
    // Gym names — visible to anyone who can see stats (owner + challenge partners).
    // Uses admin client since viewer-scoped RLS only covers the viewer's own gyms.
    canSeeStats
      ? createAdminClient()
          .from("user_gyms")
          .select("name")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: true })
          .then((r) => (r.data ?? []).map((g) => g.name))
      : Promise.resolve([] as string[]),
    // Cycle-data sharing: a non-owner can view this profile's cycle data if the
    // owner has granted them access via period_sharing. The grantee_read RLS
    // policy lets the viewer read their own grant row.
    !isOwner && profile.gender === "female"
      ? supabase
          .from("period_sharing")
          .select("owner_id")
          .eq("owner_id", profile.id)
          .eq("shared_with_id", viewerProfile.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  // Build the read-only cycle popup data for an authorised non-owner viewer
  // (periodShareRow is only ever fetched for non-owners of female profiles).
  // Uses the admin client because viewer RLS doesn't cover another user's rows.
  let popupStats: ReturnType<typeof computePeriodStats> | null = null;
  let popupRecords: Array<{ local_day: string; flow_level: "light" | "medium" | "heavy" | "unspecified" }> = [];
  if (periodShareRow != null) {
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

  const displayName = profile.name?.trim() || `@${profile.username}`;
  const joinedDate = new Date(profile.created_at).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        <section className="animate-fade-up-item rounded-[2rem] glass-card p-5">
          {/* Identity band — avatar vertically centered against the name block */}
          <div className="flex items-center gap-4">
            {/* Fixed to the avatar width so AvatarUpload's status/error text
                can't widen the column and shove the name around. */}
            <div className="w-20 shrink-0">
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
            </div>

            <div className="min-w-0 flex-1">
              {isOwner ? (
                <>
                  <NameEditor currentName={profile.name ?? ""} />
                  <div className="mt-0.5">
                    <UsernameEditor currentUsername={profile.username!} />
                  </div>
                </>
              ) : (
                <>
                  <h1 className="truncate text-xl font-semibold text-white">{displayName}</h1>
                  <p className="mt-0.5 truncate text-sm text-white/55">@{profile.username}</p>
                </>
              )}
              <p className="mt-1 text-xs text-white/40">Joined {joinedDate}</p>
            </div>
          </div>

          {/* Stat band — two-up, sharing the icon+label section headers used
              across the rest of the page. */}
          {stats ? (
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
              <div>
                <div className="flex items-center gap-1.5 text-white/45">
                  <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                  <p className="text-xs uppercase tracking-[0.18em]">Streak</p>
                </div>
                <p className="mt-2 text-3xl font-bold leading-none text-white">
                  {stats.weekStreak}
                  <span className="ml-1.5 text-sm font-medium text-white/45">
                    wk{stats.weekStreak === 1 ? "" : "s"}
                  </span>
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-white/45">
                  <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <p className="text-xs uppercase tracking-[0.18em]">This week</p>
                </div>
                <p className="mt-2 text-3xl font-bold leading-none text-white">
                  {stats.thisWeekCheckins}
                  <span className="text-base font-medium text-white/35">/{stats.weeklyGoal}</span>
                </p>
              </div>
            </div>
          ) : null}

          {!isOwner && canSeeStats ? (
            <div className="mt-4">
              <ChallengeButton
                targetUserId={profile.id}
                targetUsername={profile.username!}
                targetName={displayName}
                className="w-full"
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
          <section className="animate-fade-up-item rounded-[2rem] glass-card p-5" style={{ "--stagger": "60ms" } as React.CSSProperties}>
            <p className="text-base font-semibold text-white">Private profile</p>
            <p className="mt-1 text-sm text-white/55">
              This user keeps their stats private. Start a challenge together to see them.
            </p>
            <div className="mt-4">
              <ChallengeButton
                targetUserId={profile.id}
                targetUsername={profile.username!}
                targetName={displayName}
                className="w-full"
              />
            </div>
          </section>
        ) : stats ? (
          <>
            <section className="animate-fade-up-item rounded-[2rem] glass-card px-4 py-4" style={{ "--stagger": "60ms" } as React.CSSProperties}>
              <div className="mb-3 flex items-center gap-1.5 text-white/45">
                <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                <p className="text-xs uppercase tracking-[0.18em]">Activity</p>
              </div>
              <CheckinStrip
                today={today}
                startDay={joinedDay}
                history={stats.history}
                restDays={Array.isArray(profile.rest_days) ? profile.rest_days : []}
              />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-xs text-white/55">
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
              <section className="animate-fade-up-item rounded-[2rem] glass-card p-5" style={{ "--stagger": "180ms" } as React.CSSProperties}>
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
                <section className="animate-fade-up-item rounded-[2rem] glass-card p-5" style={{ "--stagger": "180ms" } as React.CSSProperties}>
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

                <section className="animate-fade-up-item rounded-[2rem] glass-card p-5" style={{ "--stagger": "180ms" } as React.CSSProperties}>
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

                <section className="animate-fade-up-item rounded-[2rem] glass-card p-5" style={{ "--stagger": "180ms" } as React.CSSProperties}>
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

            {isOwner ? (
              <VisibilityToggle
                initial={(profile.profile_visibility as "public" | "private") ?? "public"}
              />
            ) : null}
          </>
        ) : null}
      </main>
    </>
  );
}

