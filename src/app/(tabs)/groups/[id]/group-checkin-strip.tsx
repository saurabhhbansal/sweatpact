"use client";

import { useLayoutEffect, useRef, useState } from "react";

export type CalendarMember = {
  userId: string;
  name: string;
  restDays: number[]; // 0 = Sun … 6 = Sat
};

type Props = {
  today: string; // YYYY-MM-DD in the user's local timezone
  startDay: string; // group.created_at date part
  members: CalendarMember[]; // ordered: current user first
  // local_day → userId → best status
  calendarData: Record<string, Record<string, string>>;
};

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short" });

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

// ── SVG helpers ────────────────────────────────────────────────────────────

const CX = 18;
const CY = 18;
const R = 15;

function rad(deg: number) {
  return (deg * Math.PI) / 180;
}

// Wedge from centre → arc → back to centre.
function wedgePath(startDeg: number, endDeg: number): string {
  const x1 = CX + R * Math.cos(rad(startDeg));
  const y1 = CY + R * Math.sin(rad(startDeg));
  const x2 = CX + R * Math.cos(rad(endDeg));
  const y2 = CY + R * Math.sin(rad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

// Outer arc only (no centre lines) — used for unverified dashed ring.
function outerArcPath(startDeg: number, endDeg: number): string {
  const x1 = CX + R * Math.cos(rad(startDeg));
  const y1 = CY + R * Math.sin(rad(startDeg));
  const x2 = CX + R * Math.cos(rad(endDeg));
  const y2 = CY + R * Math.sin(rad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function segmentFill(status: string): string {
  switch (status) {
    case "verified":
      return "#10b981"; // emerald-500
    case "unverified":
      return "rgba(52,211,153,0.25)"; // emerald-400 tinted
    case "missed":
    case "rejected":
      return "rgba(239,68,68,0.35)"; // red-500 tinted
    case "rest_day":
    case "sick_day":
    case "gym_closed":
    case "period_day":
      return "rgba(255,255,255,0.06)";
    case "future":
      return "rgba(255,255,255,0.02)";
    default: // pending
      return "rgba(255,255,255,0.03)";
  }
}

// ── Status label for popup ─────────────────────────────────────────────────

function statusLabel(status: string): { text: string; cls: string } {
  switch (status) {
    case "verified":
      return { text: "Checked in", cls: "text-emerald-400" };
    case "unverified":
      return { text: "Unverified", cls: "text-emerald-300" };
    case "missed":
    case "rejected":
      return { text: status === "missed" ? "Missed" : "Rejected", cls: "text-red-400" };
    case "rest_day":
      return { text: "Rest day", cls: "text-white/45" };
    case "sick_day":
      return { text: "Sick day", cls: "text-white/45" };
    case "gym_closed": // legacy alias of rest_day
      return { text: "Rest day", cls: "text-white/45" };
    case "period_day":
      return { text: "Rest day", cls: "text-white/45" };
    case "future":
      return { text: "—", cls: "text-white/20" };
    default:
      return { text: "No check-in", cls: "text-white/30" };
  }
}

function StatusDot({ status }: { status: string }) {
  let cls = "h-2 w-2 rounded-full shrink-0 ";
  switch (status) {
    case "verified":
      cls += "bg-emerald-500";
      break;
    case "unverified":
      cls += "border border-dashed border-emerald-400 bg-emerald-400/20";
      break;
    case "missed":
    case "rejected":
      cls += "bg-red-500/70";
      break;
    case "rest_day":
    case "sick_day":
    case "gym_closed":
    case "period_day":
      cls += "bg-white/20";
      break;
    default:
      cls += "bg-white/10";
  }
  return <span className={cls} />;
}

// ── Legend ─────────────────────────────────────────────────────────────────

// Static key explaining the calendar's colour treatments. Reuses StatusDot so
// the swatches always match the live pie segments.
export function CalendarLegend() {
  const items: Array<{ status: string; label: string }> = [
    { status: "verified", label: "Checked in" },
    { status: "unverified", label: "Unverified" },
    { status: "missed", label: "Missed / rejected" },
    { status: "rest_day", label: "Rest / excused" },
  ];

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
        Reading the calendar
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {items.map((item) => (
          <div key={item.status} className="flex items-center gap-2">
            <StatusDot status={item.status} />
            <span className="text-sm text-white/70">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function GroupCheckinStrip({
  today,
  startDay,
  members,
  calendarData,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const start = startDay <= today ? startDay : today;
  const end = addDays(today, 7);
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    days.push(day);
    if (days.length > 800) break;
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-day="${today}"]`);
    if (target) {
      el.scrollLeft =
        target.offsetLeft - el.clientWidth / 2 + target.clientWidth / 2;
    }
    setReady(true);
  }, [today]);

  const n = members.length;
  const sliceDeg = 360 / Math.max(n, 1);

  function statusFor(day: string, userId: string, isFuture: boolean): string {
    const recorded = calendarData[day]?.[userId];
    if (recorded) return recorded;
    if (isFuture) return "future";
    const dow = new Date(day).getUTCDay();
    const member = members.find((m) => m.userId === userId);
    if (member?.restDays.includes(dow)) return "rest_day";
    // "missed" is derived at read time, not stored: a past day with no check-in
    // and no rest-day exemption is a miss. Today stays "pending" — still time
    // to check in. Mirrors the dashboard/profile strip (checkin-strip.tsx).
    return day < today ? "missed" : "pending";
  }

  function handleDayClick(day: string) {
    setSelectedDay((prev) => (prev === day ? null : day));
  }

  const popupDate = selectedDay
    ? new Date(selectedDay).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        weekday: "short",
      })
    : null;

  const popupEntries = selectedDay
    ? members.map((m) => ({
        userId: m.userId,
        name: m.name,
        status: statusFor(selectedDay, m.userId, selectedDay > today),
      }))
    : [];

  return (
    <div className="space-y-2">
      {/* Scrollable day strip */}
      <div
        ref={scrollRef}
        className={`no-scrollbar flex gap-2 overflow-x-auto pb-1 ${ready ? "" : "opacity-0"}`}
      >
        {days.map((day, i) => {
          const date = new Date(day);
          const d = date.getUTCDate();
          const dow = date.getUTCDay();
          const isToday = day === today;
          const isFuture = day > today;
          const isSelected = day === selectedDay;
          const showMonth =
            i === 0 || day.slice(5, 7) !== days[i - 1].slice(5, 7);

          const statuses = members.map((m) =>
            statusFor(day, m.userId, isFuture)
          );

          return (
            <div
              key={day}
              data-day={day}
              className="flex shrink-0 cursor-pointer flex-col items-center gap-0.5"
              onClick={() => handleDayClick(day)}
            >
              <span className="h-3 text-[9px] uppercase tracking-wide text-white/35">
                {showMonth ? monthFmt.format(date) : ""}
              </span>
              <span className="text-[10px] text-white/40">{DOW[dow]}</span>
              <div
                className={`rounded-full transition-all ${
                  isToday
                    ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                    : ""
                } ${isSelected ? "opacity-100" : "opacity-90 hover:opacity-100"}`}
              >
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 36 36"
                  className="block"
                >
                  {/* Base circle */}
                  <circle
                    cx={CX}
                    cy={CY}
                    r={R}
                    fill="rgba(255,255,255,0.04)"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1"
                  />

                  {n === 1 ? (
                    // Single member — full circle
                    <>
                      <circle
                        cx={CX}
                        cy={CY}
                        r={R}
                        fill={segmentFill(statuses[0])}
                      />
                      {statuses[0] === "unverified" && (
                        <circle
                          cx={CX}
                          cy={CY}
                          r={R - 1}
                          fill="none"
                          stroke="#34d399"
                          strokeWidth="2"
                          strokeDasharray="2.5 2"
                        />
                      )}
                      {(statuses[0] === "missed" ||
                        statuses[0] === "rejected") && (
                        <circle
                          cx={CX}
                          cy={CY}
                          r={R - 0.5}
                          fill="none"
                          stroke="rgba(239,68,68,0.6)"
                          strokeWidth="1.5"
                        />
                      )}
                    </>
                  ) : (
                    // Multi-member pie
                    <>
                      {statuses.map((status, mi) => {
                        const startDeg = -90 + mi * sliceDeg;
                        const endDeg = -90 + (mi + 1) * sliceDeg;
                        return (
                          <g key={mi}>
                            <path
                              d={wedgePath(startDeg, endDeg)}
                              fill={segmentFill(status)}
                            />
                            {status === "unverified" && (
                              <path
                                d={outerArcPath(startDeg + 1, endDeg - 1)}
                                fill="none"
                                stroke="#34d399"
                                strokeWidth="2"
                                strokeDasharray="2.5 2"
                              />
                            )}
                            {(status === "missed" || status === "rejected") && (
                              <path
                                d={outerArcPath(startDeg + 1, endDeg - 1)}
                                fill="none"
                                stroke="rgba(239,68,68,0.6)"
                                strokeWidth="1.5"
                              />
                            )}
                          </g>
                        );
                      })}

                      {/* Dividing lines between segments */}
                      {members.map((_, mi) => {
                        const angleDeg = -90 + mi * sliceDeg;
                        const ex = CX + R * Math.cos(rad(angleDeg));
                        const ey = CY + R * Math.sin(rad(angleDeg));
                        return (
                          <line
                            key={mi}
                            x1={CX}
                            y1={CY}
                            x2={ex.toFixed(2)}
                            y2={ey.toFixed(2)}
                            stroke="rgba(0,0,0,0.55)"
                            strokeWidth="1.5"
                          />
                        );
                      })}
                    </>
                  )}

                  {/* Date number */}
                  <text
                    x={CX}
                    y={CY + 0.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill={
                      isFuture ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.8)"
                    }
                    style={{ userSelect: "none" }}
                  >
                    {d}
                  </text>
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Day detail popup */}
      {selectedDay && (
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 backdrop-blur-sm">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-white/35">
            {popupDate}
          </p>
          <div className="space-y-1.5">
            {popupEntries.map((entry) => {
              const { text, cls } = statusLabel(entry.status);
              return (
                <div
                  key={entry.userId}
                  className="flex items-center gap-2"
                >
                  <StatusDot status={entry.status} />
                  <span className="flex-1 truncate text-sm text-white">
                    {entry.name}
                  </span>
                  <span className={`text-xs ${cls}`}>{text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
