import Link from "next/link";

// DASH-02 date-range segmented control. Server-safe (no client state): the
// active range is the `?range` searchParam, so each option is a plain Link to
// /admin?range=<r>. The page (Plan 06) reads the searchParam and passes the
// validated current value back in.
export type RangeControlProps = {
  current: "7d" | "30d" | "90d";
};

const RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
] as const;

export function RangeControl({ current }: RangeControlProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
      {RANGES.map((r) => {
        const active = r.value === current;
        return (
          <Link
            key={r.value}
            href={`/admin?range=${r.value}`}
            aria-current={active ? "true" : undefined}
            className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-medium transition ${
              active
                ? "bg-white text-black"
                : "text-white/55 hover:text-white"
            }`}
          >
            {r.label}
          </Link>
        );
      })}
    </div>
  );
}
