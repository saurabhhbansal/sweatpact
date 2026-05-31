// Shared helpers for rendering challenges (the /groups list + detail pages).
// Pure functions only — safe to import into server components.

// Rank statuses so we keep the "best" one when a user has multiple check-in
// rows for the same day in a group.
const STATUS_RANK: Record<string, number> = {
  verified: 6,
  sick_day: 5,
  gym_closed: 5,
  rest_day: 5,
  period_day: 5,
  unverified: 4,
  rejected: 3,
  missed: 2,
  pending: 0,
};

export function betterStatus(next: string, current?: string): string {
  if (!current) return next;
  return (STATUS_RANK[next] ?? 0) > (STATUS_RANK[current] ?? 0) ? next : current;
}

export type StatusTone = "green" | "slate" | "red" | "dim";

export type StatusToken = {
  icon: string;
  tone: StatusTone;
  label: string;
};

// Map a check-in status to a compact versus-card token (icon + tone + label).
export function statusToken(status: string | undefined | null): StatusToken {
  switch (status) {
    case "verified":
    case "unverified":
      return { icon: "✓", tone: "green", label: "checked in" };
    case "rest_day":
    case "sick_day":
    case "period_day":
    case "gym_closed":
      return { icon: "•", tone: "slate", label: "excused" };
    case "missed":
    case "rejected":
      return { icon: "✗", tone: "red", label: "missed" };
    default:
      return { icon: "—", tone: "dim", label: "no check-in yet" };
  }
}

// Tailwind text colour per tone — used for the status icon/label.
export const TONE_TEXT: Record<StatusTone, string> = {
  green: "text-emerald-400",
  slate: "text-white/55",
  red: "text-red-400",
  dim: "text-white/30",
};

// Avatar ring classes for a check-in status. Applied to a padded wrapper around
// <Avatar> so the colour reads as a ring (verified = solid green, unverified =
// dotted green, missed = red, excused = neutral, pending = dim).
export function statusRing(status: string | undefined | null): string {
  switch (status) {
    case "verified":
      return "border-2 border-emerald-500";
    case "unverified":
      return "border-2 border-dashed border-emerald-400";
    case "missed":
    case "rejected":
      return "border-2 border-red-500/70";
    case "rest_day":
    case "sick_day":
    case "period_day":
    case "gym_closed":
      return "border-2 border-white/20";
    default:
      return "border-2 border-white/10";
  }
}
