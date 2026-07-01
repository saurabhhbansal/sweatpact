import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Regression guard for the class of bug that silently broke weekly enforcement:
// `.upsert(..., { onConflict: "user_id,local_day,reason" })` referenced a unique
// constraint that migration 0004 had dropped, so every insert threw Postgres
// 42P10 at runtime. The unit tests mock Supabase and never validate the conflict
// target against the schema, so this ties the code's onConflict strings to the
// unique indexes/constraints actually declared in the migrations.
//
// It only understands PLAIN column-list unique indexes/constraints (not
// expression indexes) — which is exactly the point: PostgREST can only target a
// plain one, so a plain index MUST exist for each onConflict the code uses.

const repoRoot = process.cwd();

function normalizeCols(colList: string): string {
  return colList
    .split(",")
    .map((c) => c.trim().replace(/["`]/g, ""))
    .filter(Boolean)
    .sort()
    .join(",");
}

function collectPlainUniqueTargets(sql: string): Set<string> {
  const targets = new Set<string>();

  // create unique index [if not exists] <name> on <table> ( <cols> )
  const idxRe = /create\s+unique\s+index[^(]*\(([^)]*)\)/gi;
  // unique ( <cols> )  and  add constraint <name> unique ( <cols> )
  const consRe = /\bunique\s*\(([^)]*)\)/gi;
  // composite primary key ( <cols> ) — PostgREST can target a PK for onConflict too
  const pkRe = /\bprimary\s+key\s*\(([^)]*)\)/gi;

  for (const re of [idxRe, consRe, pkRe]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      const cols = m[1];
      // Skip expression indexes (e.g. coalesce(...)) — not targetable by PostgREST.
      if (/\(/.test(cols) || /coalesce/i.test(cols)) continue;
      targets.add(normalizeCols(cols));
    }
  }
  return targets;
}

describe("penalty/obligation onConflict targets match a real unique index", () => {
  const migrationsDir = path.join(repoRoot, "supabase", "migrations");
  const sql = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(path.join(migrationsDir, f), "utf8"))
    .join("\n");
  const uniqueTargets = collectPlainUniqueTargets(sql);

  const source = readFileSync(
    path.join(repoRoot, "src", "lib", "checkin-reconciliation.ts"),
    "utf8"
  );
  const onConflicts = [...source.matchAll(/onConflict:\s*"([^"]+)"/g)].map((m) => m[1]);

  it("finds at least one onConflict in the reconciliation source", () => {
    expect(onConflicts.length).toBeGreaterThan(0);
  });

  it("every onConflict corresponds to a plain unique index in the migrations", () => {
    for (const target of onConflicts) {
      expect(
        uniqueTargets.has(normalizeCols(target)),
        `onConflict "${target}" has no matching plain unique index in supabase/migrations`
      ).toBe(true);
    }
  });

  it("pins the penalty conflict target to the group-aware key (0004 dropped the 3-col one)", () => {
    // Explicit pin: the migration scan can't see that 0004 dropped the legacy
    // (user_id, local_day, reason) constraint whose text still lives in 0001, so
    // guard against a silent revert to it here.
    expect(onConflicts).toContain("user_id,local_day,reason,group_id");
    expect(onConflicts).not.toContain("user_id,local_day,reason");
  });
});
