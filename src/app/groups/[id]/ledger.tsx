"use client";

import { useState } from "react";
import { Wallet, Activity } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { formatCents } from "@/lib/money";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// Two side-by-side buttons that each open an overlay: Balances and Recent activity.
export function LedgerButtons({
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
  const [open, setOpen] = useState<null | "balances" | "activity">(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setOpen("balances")}
          className="flex flex-col items-start gap-1 rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-left backdrop-blur-xl transition hover:bg-white/[0.06]"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Wallet className="h-4 w-4" /> Balances
          </span>
          <span className="text-xs text-white/45">
            {balances.length === 0 ? "All settled up" : `${balances.length} outstanding`}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen("activity")}
          className="flex flex-col items-start gap-1 rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-left backdrop-blur-xl transition hover:bg-white/[0.06]"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <Activity className="h-4 w-4" /> Recent activity
          </span>
          <span className="text-xs text-white/45">
            {activity.length === 0 ? "Nothing yet" : `${activity.length} updates`}
          </span>
        </button>
      </div>

      {/* Balances overlay */}
      <Dialog open={open === "balances"} onOpenChange={(o) => setOpen(o ? "balances" : null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Balances</DialogTitle>
            <DialogDescription>
              {balances.length === 0 ? "All settled up" : `${balances.length} outstanding`}
              {disputes.length > 0 ? ` · ${disputes.length} open disputes` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-3">
            {balances.length === 0 ? (
              <p className="text-sm text-white/55">No pending obligations right now.</p>
            ) : (
              balances.map((b, i) => (
                <div
                  key={i}
                  className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3"
                >
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
                  <div
                    key={i}
                    className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
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
                <p className="text-xs uppercase tracking-[0.16em] text-white/45">
                  Recent settlements
                </p>
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
        </DialogContent>
      </Dialog>

      {/* Recent activity overlay */}
      <Dialog open={open === "activity"} onOpenChange={(o) => setOpen(o ? "activity" : null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recent activity</DialogTitle>
            <DialogDescription>Latest check-ins in this challenge</DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-white/55">No activity yet.</p>
            ) : (
              activity.map((row) => (
                <div
                  key={row.id}
                  className="flex items-start justify-between gap-3 rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      {row.name}
                      <span className="ml-2 text-xs uppercase tracking-[0.16em] text-white/35">
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
        </DialogContent>
      </Dialog>
    </>
  );
}
