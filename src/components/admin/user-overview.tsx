import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// DASH-03 user overview KPI card. Presentational only: an RSC component that
// renders server-computed counts as props (no hooks, no fetching, no
// "use client"). The admin page (Plan 06) supplies the four counts.
export type UserOverviewProps = {
  totalUsers: number;
  onboardedUsers: number;
  usersWithActivePact: number;
  checkedInThisWeek: number;
};

type Metric = {
  label: string;
  value: number;
};

export function UserOverview({
  totalUsers,
  onboardedUsers,
  usersWithActivePact,
  checkedInThisWeek,
}: UserOverviewProps) {
  const metrics: Metric[] = [
    { label: "Registered", value: totalUsers },
    { label: "Onboarded", value: onboardedUsers },
    { label: "With active pact", value: usersWithActivePact },
    { label: "Checked in this week", value: checkedInThisWeek },
  ];

  return (
    <Card className="rounded-[2rem] glass-card">
      <CardHeader>
        <CardTitle>User overview</CardTitle>
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
