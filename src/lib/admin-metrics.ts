// Pure admin-dashboard computation helpers (DASH-01/02/03).
//
// This module is intentionally side-effect free: no DB calls, no React, no
// "use client". The RSC page (Plan 06) fetches rows via the service-role admin
// client and feeds them into these helpers, so all financial + trend math is
// server-authoritative and unit-testable without a database.

import { isoWeekMonday } from "@/lib/derived-status";

// Re-export for admin financial display (shared pattern — components import
// formatCents from here alongside the metric helpers).
export { formatCents } from "@/lib/money";

// --- DASH-01: financial overview -----------------------------------------

// Penalties settled / penalties owed, where owed = settled + pending obligation
// rows. Disputed/voided obligations are excluded from the denominator by the
// caller (they are never passed in as pending) — see RESEARCH A5.
export function settlementRate(settled: number, pending: number): number {
  const total = settled + pending;
  return total === 0 ? 0 : settled / total;
}

// A live pact is structurally a `groups` row with >= 2 `group_members`
// (RESEARCH Open Q1 / A1; group_members PK is (group_id, user_id), unique(user_id)).
// PLANNER RESOLUTION of RESEARCH Open Q1 — confirm against owner intent in UAT.
export function activePactCount(
  memberRows: Array<{ group_id: string }>
): number {
  const counts = new Map<string, number>();
  for (const { group_id } of memberRows) {
    counts.set(group_id, (counts.get(group_id) ?? 0) + 1);
  }
  let active = 0;
  for (const n of counts.values()) {
    if (n >= 2) active++;
  }
  return active;
}

// Total money at stake = sum of each active group's configured penalty
// (RESEARCH A2: stake source is the group's default_penalty_cents). Each active
// group contributes its stake once; cents are integers.
export function totalStakesCents(
  activeGroups: Array<{ default_penalty_cents: number }>
): number {
  return activeGroups.reduce((sum, g) => sum + g.default_penalty_cents, 0);
}

// --- DASH-03: user overview ----------------------------------------------

// Count distinct user_ids that belong to a group with >= 2 members. A user is
// counted once even if they (somehow) appear across multiple active groups.
export function usersWithActivePact(
  memberRows: Array<{ group_id: string; user_id: string }>
): number {
  const groupCounts = new Map<string, number>();
  for (const { group_id } of memberRows) {
    groupCounts.set(group_id, (groupCounts.get(group_id) ?? 0) + 1);
  }
  const users = new Set<string>();
  for (const { group_id, user_id } of memberRows) {
    if ((groupCounts.get(group_id) ?? 0) >= 2) users.add(user_id);
  }
  return users.size;
}
