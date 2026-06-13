"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { formatCents } from "@/lib/money";
import { ObligationActions } from "./obligation-actions";

export type BalanceRow = {
  fromName: string;
  toName: string;
  totalCents: number;
  obligationIds: string[];
  isMine: boolean;
  weeks: number;
};
export type DisputeRow = { raisedByName: string; targetType: string; reason: string };
export type SettlementRow = { markedByName: string; amountLabel: string; dateLabel: string };
export type ActivityRow = {
  id: string;
  name: string;
  source: string;
  timeLabel: string;
  status: string;
  distanceM: number | null;
};

function segClass(active: boolean) {
  return `flex-1 rounded-full py-2 text-sm font-medium transition ${
    active ? "bg-white text-black" : "text-white/55 hover:text-white"
  }`;
}

// Inline segmented Balances / Activity panel (replaces two buttons that each
// opened a dialog). Balances lists outstanding obligations with inline settle
// actions; Activity lists recent check-ins. One shell, inset rows.
export function LedgerPanel({
  balances,
  disputes,
  settlements,
  activity,
}: {
  balances: BalanceRow[];
  disputes: DisputeRow[];
  settlements: SettlementRow[];
  activity: ActivityRow[];
}) {
  const [tab, setTab] = useState<"balances" | "activity">("balances");

  return (
    <section className="rounded-[2rem] glass-card p-5">
      <div className="flex rounded-full border border-white/15 bg-white/[0.04] p-0.5">
        <button type="button" onClick={() => setTab("balances")} className={segClass(tab === "balances")}>
          Balances
        </button>
        <button type="button" onClick={() => setTab("activity")} className={segClass(tab === "activity")}>
          Activity
        </button>
      </div>

      {tab === "balances" ? (
        <div className="mt-4 space-y-3">
          {balances.length === 0 ? (
            <p className="text-sm text-white/55">All settled up — no pending obligations.</p>
          ) : (
            balances.map((b, i) => (
              <div key={i} className="rounded-[1.4rem] bg-white/[0.04] px-4 py-3">
                <div className="text-sm text-white">
                  <span className="font-medium">{b.fromName}</span>
                  {" owes "}
                  <span className="font-medium">{b.toName}</span>{" "}
                  <span className="font-semibold">{formatCents(b.totalCents)}</span>
                </div>
                {b.weeks > 1 ? (
                  <p className="mt-1 text-xs text-white/40">{b.weeks} unpaid weeks</p>
                ) : null}
                {b.isMine ? (
                  <div className="mt-3">
                    <ObligationActions obligationIds={b.obligationIds} />
                  </div>
                ) : null}
              </div>
            ))
          )}

          {disputes.length > 0 ? (
            <div className="space-y-2 border-t border-white/10 pt-3">
              {disputes.map((d, i) => (
                <div key={i} className="rounded-[1.4rem] bg-white/[0.04] px-4 py-3">
                  <p className="text-sm text-white">
                    {d.raisedByName} · {d.targetType}
                  </p>
                  <p className="truncate text-xs text-white/45">{d.reason}</p>
                </div>
              ))}
            </div>
          ) : null}

          {settlements.length > 0 ? (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Recent settlements</p>
              {settlements.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-white/70">
                    {s.markedByName} settled {s.amountLabel}
                  </span>
                  <span className="text-white/40">{s.dateLabel}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {activity.length === 0 ? (
            <p className="text-sm text-white/55">No activity yet.</p>
          ) : (
            activity.map((row) => (
              <div
                key={row.id}
                className="flex items-start justify-between gap-3 rounded-[1.4rem] bg-white/[0.04] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {row.name}
                    <span className="ml-2 text-xs uppercase tracking-[0.08em] text-white/35">
                      {row.source}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-white/45">{row.timeLabel}</p>
                  {row.distanceM != null ? (
                    <p className="mt-1 text-xs text-white/45">
                      {Math.round(row.distanceM)} m from gym
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={row.status} />
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
