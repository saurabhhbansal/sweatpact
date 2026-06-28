"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { WeekBucket } from "@/lib/admin-metrics";

// DASH-02 check-in trend chart. This is a "use client" recharts island —
// recharts cannot render inside an RSC, so the page (Plan 06) precomputes the
// WeekBucket[] server-side and passes it as serializable props. The component
// never fetches: only aggregated counts cross the RSC -> client boundary
// (no per-user identifiers — threat T-09-11).
export type CheckinTrendChartProps = {
  data: WeekBucket[];
};

// Brand chart palette (UI-SPEC): total = white (primary), verified = success
// emerald, geo-fail = destructive red. Grid/axes use the muted border token.
const COLOR_TOTAL = "hsl(0 0% 100%)";
const COLOR_VERIFIED = "hsl(var(--success))";
const COLOR_GEO_FAIL = "hsl(var(--destructive))";
const COLOR_AXIS = "hsl(0 0% 60%)";
const COLOR_GRID = "hsl(0 0% 18%)";

export function CheckinTrendChart({ data }: CheckinTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={COLOR_GRID} strokeOpacity={0.5} vertical={false} />
        <XAxis
          dataKey="week"
          stroke={COLOR_AXIS}
          tick={{ fill: COLOR_AXIS, fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          stroke={COLOR_AXIS}
          tick={{ fill: COLOR_AXIS, fontSize: 12 }}
          tickLine={false}
          allowDecimals={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(0 0% 6%)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "0.75rem",
            color: "#fff",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.55)" }}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke={COLOR_TOTAL}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="verified"
          stroke={COLOR_VERIFIED}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="geoFail"
          stroke={COLOR_GEO_FAIL}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
