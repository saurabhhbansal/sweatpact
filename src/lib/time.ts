// Timezone-aware date helpers.
//
// Convention: a user's "local day" is the YYYY-MM-DD that the given instant
// falls into when projected into the user's IANA timezone. We use Intl
// (`en-CA` gives ISO YYYY-MM-DD parts) so we don't need a date lib.

type DateParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
};

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

export function normalizeTimeZone(tz: string | null | undefined): string {
  const candidate = (tz ?? "").trim();
  if (!candidate) return DEFAULT_TIME_ZONE;
  try {
    // Invalid zone names throw a RangeError.
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function isValidTimeZone(tz: string): boolean {
  const candidate = tz.trim();
  return candidate.length > 0 && normalizeTimeZone(candidate) === candidate;
}

function partsInZone(at: Date, tz: string): DateParts {
  const safeTz = normalizeTimeZone(tz);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(at).map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Intl can return "24" for midnight in some locales — normalize.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

export function localDay(at: Date, tz: string): string {
  const { year, month, day } = partsInZone(at, tz);
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

// Local day for "yesterday" relative to the current instant in tz.
export function previousLocalDay(at: Date, tz: string): string {
  const today = localDay(at, tz);
  // Subtract ~24h and re-project. This is good enough; on DST boundaries the
  // resulting date may shift by the DST delta but remains close enough for enforcement.
  const back = new Date(at.getTime() - 24 * 60 * 60 * 1000);
  const yesterday = localDay(back, tz);
  // Defensive: if subtracting 24h didn't change the date (very unusual), step further.
  if (yesterday === today) {
    return localDay(new Date(at.getTime() - 36 * 60 * 60 * 1000), tz);
  }
  return yesterday;
}
