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
  weeklyGoal: number
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
    const count = weekCheckins.get(mon) ?? 0;
    const isCurrentWeek = mon === currentWeekMonday;
    if (count >= weeklyGoal) {
      weekStreak++;
    } else if (!isCurrentWeek) {
      break;
    }
  }
  return weekStreak;
}
