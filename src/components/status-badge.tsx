import type React from "react";
import { Badge } from "@/components/ui/badge";

type Status =
  | "verified"
  | "unverified"
  | "missed"
  | "pending"
  | "settled"
  | "disputed"
  | "voided"
  | "open"
  | "resolved"
  | "rejected"
  | "sick_day"
  | "gym_closed"
  | "rest_day"
  | "period_day";

const map: Record<
  Status,
  { variant: React.ComponentProps<typeof Badge>["variant"]; label: string }
> = {
  verified: { variant: "success", label: "Verified" },
  unverified: { variant: "warning", label: "Unverified" },
  missed: { variant: "destructive", label: "Missed" },
  pending: { variant: "muted", label: "Pending" },
  settled: { variant: "success", label: "Settled" },
  disputed: { variant: "destructive", label: "Disputed" },
  voided: { variant: "muted", label: "Voided" },
  open: { variant: "warning", label: "Open" },
  resolved: { variant: "success", label: "Resolved" },
  rejected: { variant: "muted", label: "Rejected" },
  sick_day: { variant: "secondary", label: "Sick day" },
  gym_closed: { variant: "secondary", label: "Gym closed" },
  rest_day: { variant: "secondary", label: "Rest day" },
  period_day: { variant: "secondary", label: "Period day" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = map[(status as Status) ?? "pending"] ?? map.pending;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
