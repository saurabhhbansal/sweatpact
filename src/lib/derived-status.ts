// Read-time status derivations shared by the dashboard, profile stats, and
// challenge calendars. "missed" is never stored for display purposes — it is
// derived from the absence of a record on a past, non-rest day — so every
// surface must derive it the same way or calendars drift apart.

export const EXCUSED_STATUSES = new Set([
  "sick_day",
  "gym_closed",
  "rest_day",
  "period_day",
]);

export function shouldCountTowardStreak(status: string) {
  return status === "verified" || status === "unverified";
}

// Returns the ISO-week Monday for a YYYY-MM-DD date string.
export function isoWeekMonday(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = (date.getUTCDay() + 6) % 7; // 0=Mon, 6=Sun
  date.setUTCDate(date.getUTCDate() - dow);
  return date.toISOString().slice(0, 10);
}

// Shift a YYYY-MM-DD date string by n calendar days (UTC-anchored, DST-agnostic).
function addDaysStr(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// Inclusive day count between two YYYY-MM-DD strings (a <= b): b - a + 1.
function daysBetweenInclusive(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.floor(ms / 86_400_000) + 1;
}

// Count gym-eligible (non-rest) days in the inclusive range [startDay, endDay].
// restDays uses JS day-of-week numbers (0=Sun … 6=Sat), matching profiles.rest_days.
function countNonRestDays(startDay: string, endDay: string, restDays: number[]): number {
  const rest = new Set(restDays);
  let count = 0;
  let cursor = startDay;
  while (cursor <= endDay) {
    const [y, m, d] = cursor.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (!rest.has(dow)) count++;
    cursor = addDaysStr(cursor, 1);
  }
  return count;
}

// Effective weekly goal for one ISO week, accounting for a mid-week join. This is
// the single source of truth shared by weekly enforcement (money), the streak
// calculation, and the "X / goal" UI so all three always agree.
//
//   joinDay <= weekMonday  → full goal (member for the whole week)
//   joinDay >  weekSunday  → 0  (not a member that week; callers skip enforcement)
//   otherwise (join week)  → round(goal * availableDays / 7), min 1, additionally
//                            capped at the achievable (non-rest) days remaining so
//                            the prorated goal can never be mathematically impossible.
export function proratedWeeklyGoal(
  weeklyGoal: number,
  weekMonday: string,
  joinDay: string,
  restDays: number[] = []
): number {
  const weekSunday = addDaysStr(weekMonday, 6);
  if (joinDay <= weekMonday) return weeklyGoal;
  if (joinDay > weekSunday) return 0;

  const availableDays = daysBetweenInclusive(joinDay, weekSunday); // 1..6
  const eligibleDays = countNonRestDays(joinDay, weekSunday, restDays);
  if (eligibleDays === 0) return 0; // every remaining day is a rest day → nothing to owe

  const raw = Math.round((weeklyGoal * availableDays) / 7);
  return Math.min(weeklyGoal, eligibleDays, Math.max(1, raw));
}

// Display status for a calendar day: recorded status wins; otherwise future
// days are "future", rest days "rest_day", past days "missed", today "pending"
// (still time to check in).
export function deriveDayStatus(opts: {
  recorded: string | null | undefined;
  day: string;
  today: string;
  isRestDay: boolean;
}): string {
  const { recorded, day, today, isRestDay } = opts;
  if (recorded) return recorded;
  if (day > today) return "future";
  if (isRestDay) return "rest_day";
  return day < today ? "missed" : "pending";
}

// Weekly streak: walk ISO weeks from the most recent backward. A week counts
// when its check-ins meet the goal; a past complete week below goal ends the
// streak; the current in-progress week below goal neither counts nor breaks.
export function computeWeekStreak(
  statusByDay: Map<string, string>,
  today: string,
  weeklyGoal: number,
  // When provided, the ISO week containing joinDay uses a prorated goal so a
  // user's own partial first week is judged fairly (and never breaks the streak
  // just because the full goal was unreachable). Weeks entirely before joinDay
  // are skipped (neither count nor break). restDays feeds the proration cap.
  joinDay?: string,
  restDays: number[] = []
): number {
  const currentWeekMonday = isoWeekMonday(today);

  const weekCheckins = new Map<string, number>();
  for (const [day, status] of statusByDay) {
    if (!shouldCountTowardStreak(status)) continue;
    const mon = isoWeekMonday(day);
    weekCheckins.set(mon, (weekCheckins.get(mon) ?? 0) + 1);
  }

  const sortedWeekMondays = [
    ...new Set([...statusByDay.keys()].map(isoWeekMonday)),
  ].sort((a, b) => b.localeCompare(a));

  let weekStreak = 0;
  for (const mon of sortedWeekMondays) {
    const goal = joinDay ? proratedWeeklyGoal(weeklyGoal, mon, joinDay, restDays) : weeklyGoal;
    // goal === 0 → week is before the user joined: skip without counting or breaking.
    if (goal === 0) continue;
    const count = weekCheckins.get(mon) ?? 0;
    const isCurrentWeek = mon === currentWeekMonday;
    if (count >= goal) {
      weekStreak++;
    } else if (!isCurrentWeek) {
      break;
    }
  }
  return weekStreak;
}
