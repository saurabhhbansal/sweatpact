import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";

// DASH-01 financial overview KPI card. Presentational only: an RSC component
// that renders server-computed props (no hooks, no fetching, no "use client").
// The admin page (Plan 06) fetches via the service-role client and passes props.
export type FinancialOverviewProps = {
  activePactCount: number;
  totalStakesCents: number;
  totalPenaltiesCents: number;
  /** Settlement completion rate in the 0..1 range (settled / (settled+pending)). */
  settlementRate: number;
};

type Metric = {
  label: string;
  value: string;
};

export function FinancialOverview({
  activePactCount,
  totalStakesCents,
  totalPenaltiesCents,
  settlementRate,
}: FinancialOverviewProps) {
  const metrics: Metric[] = [
    { label: "Active pacts", value: String(activePactCount) },
    { label: "Stakes on the line", value: formatCents(totalStakesCents) },
    { label: "Penalties issued", value: formatCents(totalPenaltiesCents) },
    {
      label: "Settlement rate",
      value: `${Math.round(settlementRate * 100)}%`,
    },
  ];

  return (
    <Card className="rounded-[2rem] glass-card">
      <CardHeader>
        <CardTitle>Financial overview</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-xs uppercase tracking-[0.08em] text-white/55">
              {m.label}
            </p>
            <p className="mt-1.5 text-3xl font-bold leading-tight text-white">
              {m.value}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
