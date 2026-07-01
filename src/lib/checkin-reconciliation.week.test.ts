import { describe, it, expect } from "vitest";
import { reconcileMostRecentClosedWeek, reconcileUserWeek } from "./checkin-reconciliation";

// ── Minimal in-memory Supabase stand-in ──────────────────────────────────────
// Implements just the slice of the PostgREST query builder that the weekly
// reconciliation path touches, and records penalty upserts + obligation inserts
// so tests can assert on the money split end-to-end (goal gate → penalty →
// split across N peers) without a live database.

type Row = Record<string, any>;

type Seed = {
  // null models a profile row with no weekly_goal, exercising the `?? 4` default.
  weeklyGoal: number | null;
  // daily_status rows for the user in the week under test.
  statuses: Array<{ local_day: string; status: string }>;
  // The user's memberships, each with the group relation listUserMemberships reads.
  memberships: Array<{
    group_id: string;
    penalty_cents: number | null;
    defaultPenaltyCents: number | null;
  }>;
  // Other members per group (the user is excluded by the .neq filter).
  peersByGroup: Record<string, string[]>;
};

class FakeDb {
  penaltySeq = 0;
  obligationSeq = 0;
  penalties: Row[] = [];
  obligations: Row[] = [];
  disputes: Row[] = [];
  constructor(public userId: string, public seed: Seed) {}
  from(table: string) {
    return new FakeQuery(this, table);
  }
}

class FakeQuery {
  private op: "select" | "insert" | "upsert" | "delete" = "select";
  private cols = "*";
  private wantSingle = false;
  private payload: any = null;
  private filters: Array<{ op: string; col: string; val: any }> = [];

  constructor(private db: FakeDb, private table: string) {}

  select(cols: string) { this.cols = cols; return this; }
  insert(rows: Row[] | Row) { this.op = "insert"; this.payload = rows; return this; }
  upsert(row: Row) { this.op = "upsert"; this.payload = row; return this; }
  delete() { this.op = "delete"; return this; }
  eq(col: string, val: any) { this.filters.push({ op: "eq", col, val }); return this; }
  neq(col: string, val: any) { this.filters.push({ op: "neq", col, val }); return this; }
  gte(col: string, val: any) { this.filters.push({ op: "gte", col, val }); return this; }
  lte(col: string, val: any) { this.filters.push({ op: "lte", col, val }); return this; }
  in(col: string, vals: any[]) { this.filters.push({ op: "in", col, val: vals }); return this; }
  order() { return this; }
  single() { this.wantSingle = true; return this; }
  maybeSingle() { this.wantSingle = true; return this; }

  private get(col: string) {
    return this.filters.find((f) => f.op === "eq" && f.col === col)?.val;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      if (f.op === "eq") return row[f.col] === f.val;
      if (f.op === "neq") return row[f.col] !== f.val;
      if (f.op === "in") return (f.val as any[]).includes(row[f.col]);
      if (f.op === "gte") return row[f.col] >= f.val;
      if (f.op === "lte") return row[f.col] <= f.val;
      return true;
    });
  }

  private compute(): { data: any; error: null } {
    const d = this.db;
    if (this.op === "delete") {
      if (this.table === "obligations") d.obligations = d.obligations.filter((r) => !this.matches(r));
      else if (this.table === "penalty_events") d.penalties = d.penalties.filter((r) => !this.matches(r));
      else if (this.table === "disputes") d.disputes = d.disputes.filter((r) => !this.matches(r));
      return { data: null, error: null };
    }
    if (this.op === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      if (this.table === "obligations") {
        d.obligations.push(...rows.map((r) => ({ id: `obl-${++d.obligationSeq}`, ...r })));
      }
      return { data: rows, error: null };
    }
    if (this.op === "upsert") {
      if (this.table === "penalty_events") {
        // Model the real (user_id, local_day, reason) unique upsert: a re-run
        // returns the existing penalty id rather than creating a new one.
        const p = this.payload;
        const existing = d.penalties.find(
          (e) =>
            e.user_id === p.user_id &&
            e.local_day === p.local_day &&
            e.reason === p.reason &&
            e.group_id === p.group_id
        );
        if (existing) return { data: { id: existing.id }, error: null };
        const id = `pen-${++d.penaltySeq}`;
        d.penalties.push({ id, ...p });
        return { data: { id }, error: null };
      }
      if (this.table === "obligations") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        // Mirror the real (penalty_event_id, to_user) unique key so a re-run is
        // idempotent, matching ignoreDuplicates.
        for (const row of rows) {
          const exists = d.obligations.some(
            (o) => o.penalty_event_id === row.penalty_event_id && o.to_user === row.to_user
          );
          if (!exists) d.obligations.push({ id: `obl-${++d.obligationSeq}`, ...row });
        }
        return { data: rows, error: null };
      }
      return { data: this.payload, error: null };
    }
    // select
    if (this.table === "profiles") {
      return { data: { id: d.userId, weekly_goal: d.seed.weeklyGoal }, error: null };
    }
    if (this.table === "daily_status") {
      const start = this.filters.find((f) => f.op === "gte")?.val;
      const end = this.filters.find((f) => f.op === "lte")?.val;
      const rows = d.seed.statuses.filter(
        (s) => (!start || s.local_day >= start) && (!end || s.local_day <= end)
      );
      return { data: rows, error: null };
    }
    if (this.table === "penalty_events") {
      return { data: d.penalties.filter((r) => this.matches(r)).map((r) => ({ id: r.id })), error: null };
    }
    if (this.table === "obligations") {
      return {
        data: d.obligations.filter((r) => this.matches(r)).map((r) => ({ id: r.id, status: r.status })),
        error: null,
      };
    }
    if (this.table === "group_members") {
      if (this.cols.includes("groups(")) {
        // listUserMemberships: the user's memberships with the group relation.
        const rows = d.seed.memberships.map((m) => ({
          group_id: m.group_id,
          user_id: d.userId,
          role: "member",
          penalty_cents: m.penalty_cents,
          joined_at: "2026-01-01",
          groups: { id: m.group_id, default_penalty_cents: m.defaultPenaltyCents },
        }));
        return { data: rows, error: null };
      }
      // Peers: members of a group, excluding the user (.neq).
      const groupId = this.get("group_id");
      const excluded = this.filters.find((f) => f.op === "neq" && f.col === "user_id")?.val;
      const peers = (d.seed.peersByGroup[groupId] ?? [])
        .filter((u) => u !== excluded)
        .map((u) => ({ user_id: u }));
      return { data: peers, error: null };
    }
    return { data: this.wantSingle ? null : [], error: null };
  }

  then(resolve: (v: { data: any; error: null }) => any, reject?: (e: any) => any) {
    try {
      const { data, error } = this.compute();
      return Promise.resolve(resolve({ data: this.wantSingle && Array.isArray(data) ? data[0] ?? null : data, error }));
    } catch (e) {
      return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
    }
  }
}

function run(seed: Seed) {
  const db = new FakeDb("u-self", seed);
  // weekEndDay is the Sunday 2026-06-14; its ISO week is Mon 2026-06-08 … Sun 2026-06-14.
  return reconcileUserWeek(db as any, {
    userId: "u-self",
    weekEndDay: "2026-06-14",
    now: new Date("2026-06-15T00:00:00Z"),
  }).then(() => db);
}

const verified = (day: string) => ({ local_day: day, status: "verified" });

describe("reconcileUserWeek — weekly penalty & obligation split", () => {
  it("creates no penalty when the weekly goal is met", async () => {
    const db = await run({
      weeklyGoal: 3,
      statuses: [verified("2026-06-08"), verified("2026-06-10"), verified("2026-06-12")],
      memberships: [{ group_id: "g1", penalty_cents: null, defaultPenaltyCents: 5000 }],
      peersByGroup: { g1: ["u-self", "p1", "p2"] },
    });
    expect(db.penalties).toHaveLength(0);
    expect(db.obligations).toHaveLength(0);
  });

  it("splits the stake evenly across peers when the goal is missed", async () => {
    const db = await run({
      weeklyGoal: 4,
      statuses: [verified("2026-06-08"), verified("2026-06-10")], // 2 < 4
      memberships: [{ group_id: "g1", penalty_cents: 9000, defaultPenaltyCents: 5000 }],
      peersByGroup: { g1: ["u-self", "p1", "p2", "p3"] },
    });
    expect(db.penalties).toHaveLength(1);
    expect(db.penalties[0]).toMatchObject({
      user_id: "u-self",
      group_id: "g1",
      amount_cents: 9000,
      reason: "missed_weekly_goal",
    });
    expect(db.obligations).toHaveLength(3);
    expect(db.obligations.map((o) => o.amount_cents)).toEqual([3000, 3000, 3000]);
    expect(db.obligations.every((o) => o.from_user === "u-self")).toBe(true);
    expect(db.obligations.map((o) => o.to_user).sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("distributes an indivisible stake so obligations sum to exactly the stake", async () => {
    const db = await run({
      weeklyGoal: 4,
      statuses: [],
      memberships: [{ group_id: "g1", penalty_cents: 5000, defaultPenaltyCents: 5000 }],
      peersByGroup: { g1: ["u-self", "p1", "p2", "p3"] }, // 5000 / 3
    });
    const amounts = db.obligations.map((o) => o.amount_cents);
    expect(amounts).toEqual([1667, 1667, 1666]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(5000);
  });

  it("uses the membership stake when set, else the group default", async () => {
    const db = await run({
      weeklyGoal: 4,
      statuses: [],
      memberships: [
        { group_id: "g1", penalty_cents: 7000, defaultPenaltyCents: 5000 }, // membership override
        { group_id: "g2", penalty_cents: null, defaultPenaltyCents: 4000 }, // group default
      ],
      peersByGroup: { g1: ["u-self", "p1"], g2: ["u-self", "p2"] },
    });
    expect(db.penalties).toHaveLength(2);
    const byGroup = Object.fromEntries(db.penalties.map((p) => [p.group_id, p.amount_cents]));
    expect(byGroup).toEqual({ g1: 7000, g2: 4000 });
    const g1Ob = db.obligations.filter((o) => o.group_id === "g1");
    const g2Ob = db.obligations.filter((o) => o.group_id === "g2");
    expect(g1Ob).toHaveLength(1);
    expect(g1Ob[0].amount_cents).toBe(7000); // single peer gets the whole stake
    expect(g2Ob[0].amount_cents).toBe(4000);
  });

  it("records the penalty but creates no obligations in a solo group (no peers)", async () => {
    const db = await run({
      weeklyGoal: 4,
      statuses: [],
      memberships: [{ group_id: "g1", penalty_cents: 5000, defaultPenaltyCents: 5000 }],
      peersByGroup: { g1: ["u-self"] }, // only the user
    });
    expect(db.penalties).toHaveLength(1);
    expect(db.obligations).toHaveLength(0);
  });

  it("defaults the weekly goal to 4 when the profile has none", async () => {
    const db = await run({
      weeklyGoal: null, // no goal set → real code uses `?? 4`
      statuses: [verified("2026-06-08"), verified("2026-06-10"), verified("2026-06-12")], // 3 < 4
      memberships: [{ group_id: "g1", penalty_cents: 5000, defaultPenaltyCents: 5000 }],
      peersByGroup: { g1: ["u-self", "p1"] },
    });
    // 3 check-ins is short of the defaulted goal of 4 → penalty created.
    expect(db.penalties).toHaveLength(1);
    expect(db.obligations.map((o) => o.amount_cents)).toEqual([5000]);
  });

  it("falls back to the 5000-cent default stake when neither stake is set", async () => {
    const db = await run({
      weeklyGoal: 4,
      statuses: [],
      memberships: [{ group_id: "g1", penalty_cents: null, defaultPenaltyCents: null }],
      peersByGroup: { g1: ["u-self", "p1", "p2"] },
    });
    expect(db.penalties[0].amount_cents).toBe(5000);
    expect(db.obligations.map((o) => o.amount_cents)).toEqual([2500, 2500]);
  });

  it("is idempotent — a second (raced/doubled) run does not double the debt", async () => {
    const seed: Seed = {
      weeklyGoal: 4,
      statuses: [],
      memberships: [{ group_id: "g1", penalty_cents: 9000, defaultPenaltyCents: 5000 }],
      peersByGroup: { g1: ["u-self", "p1", "p2", "p3"] },
    };
    const db = new FakeDb("u-self", seed);
    const opts = {
      userId: "u-self",
      weekEndDay: "2026-06-14",
      now: new Date("2026-06-15T00:00:00Z"),
    };
    await reconcileUserWeek(db as any, opts);
    await reconcileUserWeek(db as any, opts);

    expect(db.penalties).toHaveLength(1); // penalty upsert returns the same row
    expect(db.obligations).toHaveLength(3); // not 6 — obligations upsert dedupes
    expect(db.obligations.map((o) => o.amount_cents)).toEqual([3000, 3000, 3000]);
  });

  const metGoal = [
    verified("2026-06-08"),
    verified("2026-06-09"),
    verified("2026-06-10"),
    verified("2026-06-11"),
  ];

  it("reverses an unsettled weekly penalty when the goal is later met", async () => {
    const seed: Seed = {
      weeklyGoal: 4,
      statuses: [], // missed at enforcement time
      memberships: [{ group_id: "g1", penalty_cents: 9000, defaultPenaltyCents: 5000 }],
      peersByGroup: { g1: ["u-self", "p1", "p2", "p3"] },
    };
    const db = new FakeDb("u-self", seed);
    const opts = { userId: "u-self", weekEndDay: "2026-06-14", now: new Date("2026-06-15T00:00:00Z") };
    await reconcileUserWeek(db as any, opts);
    expect(db.penalties).toHaveLength(1);
    expect(db.obligations).toHaveLength(3);

    // Back-dated check-ins push the user over goal → re-running clears the debt.
    db.seed.statuses = metGoal;
    await reconcileUserWeek(db as any, opts);
    expect(db.penalties).toHaveLength(0);
    expect(db.obligations).toHaveLength(0);
  });

  it("does NOT reverse a weekly penalty once an obligation has been settled", async () => {
    const seed: Seed = {
      weeklyGoal: 4,
      statuses: [],
      memberships: [{ group_id: "g1", penalty_cents: 9000, defaultPenaltyCents: 5000 }],
      peersByGroup: { g1: ["u-self", "p1", "p2", "p3"] },
    };
    const db = new FakeDb("u-self", seed);
    const opts = { userId: "u-self", weekEndDay: "2026-06-14", now: new Date("2026-06-15T00:00:00Z") };
    await reconcileUserWeek(db as any, opts);
    db.obligations[0].status = "settled"; // money already moved

    db.seed.statuses = metGoal;
    await reconcileUserWeek(db as any, opts);
    expect(db.penalties).toHaveLength(1); // kept — a settled debt is never reversed
    expect(db.obligations).toHaveLength(3);
  });
});

describe("reconcileMostRecentClosedWeek — daily catch-up for the last closed week", () => {
  // A Wednesday mid-week run: today's ISO week is Mon 2026-06-15…Sun 2026-06-21.
  // The most recently closed week ends on the prior Sunday, 2026-06-14.
  const today = "2026-06-17";
  const now = new Date("2026-06-17T00:00:00Z");

  it("creates last week's missed-goal penalty on a non-Monday run", async () => {
    const seed: Seed = {
      weeklyGoal: 4,
      statuses: [], // no qualifying check-ins for 2026-06-08…2026-06-14 → goal missed
      memberships: [{ group_id: "g1", penalty_cents: 9000, defaultPenaltyCents: 5000 }],
      peersByGroup: { g1: ["u-self", "p1", "p2", "p3"] },
    };
    const db = new FakeDb("u-self", seed);

    await reconcileMostRecentClosedWeek(db as any, { userId: "u-self", today, now });

    expect(db.penalties).toHaveLength(1);
    expect(db.penalties[0]).toMatchObject({
      user_id: "u-self",
      local_day: "2026-06-14", // the prior Sunday, not the current in-progress week
      reason: "missed_weekly_goal",
    });
    expect(db.obligations).toHaveLength(3);
    expect(db.obligations.map((o) => o.to_user).sort()).toEqual(["p1", "p2", "p3"]);
    expect(db.obligations.map((o) => o.amount_cents)).toEqual([3000, 3000, 3000]);
  });

  it("is idempotent — a second identical catch-up call does not double the debt", async () => {
    const seed: Seed = {
      weeklyGoal: 4,
      statuses: [],
      memberships: [{ group_id: "g1", penalty_cents: 9000, defaultPenaltyCents: 5000 }],
      peersByGroup: { g1: ["u-self", "p1", "p2", "p3"] },
    };
    const db = new FakeDb("u-self", seed);

    await reconcileMostRecentClosedWeek(db as any, { userId: "u-self", today, now });
    await reconcileMostRecentClosedWeek(db as any, { userId: "u-self", today, now });

    expect(db.penalties).toHaveLength(1); // penalty upsert returns the same row
    expect(db.obligations).toHaveLength(3); // not 6 — obligations upsert dedupes
  });
});
