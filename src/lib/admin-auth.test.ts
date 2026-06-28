import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseAdminUserIds, requireOwner } from "./admin-auth";

// notFound() throws a tagged error we can assert on (mirrors Next.js, which
// throws a NEXT_NOT_FOUND digest to unwind the render).
const NOT_FOUND = "NEXT_NOT_FOUND";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
}));

// Controllable getUser() result, swapped per test.
let getUserResult: {
  data: { user: { id: string } | null };
  error: unknown;
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => getUserResult },
  }),
}));

describe("parseAdminUserIds", () => {
  it("returns [] for undefined (fail-closed)", () => {
    expect(parseAdminUserIds(undefined)).toEqual([]);
  });

  it("returns [] for empty string (fail-closed)", () => {
    expect(parseAdminUserIds("")).toEqual([]);
  });

  it("returns [] for whitespace-only input (fail-closed)", () => {
    expect(parseAdminUserIds("   ")).toEqual([]);
  });

  it("returns a single-element list for one id", () => {
    expect(parseAdminUserIds("uuid1")).toEqual(["uuid1"]);
  });

  it("trims surrounding whitespace and drops empty segments", () => {
    expect(parseAdminUserIds(" uuid1 , uuid2 , ")).toEqual(["uuid1", "uuid2"]);
  });

  it("returns [] when input is only separators", () => {
    expect(parseAdminUserIds(",,")).toEqual([]);
  });
});

describe("requireOwner", () => {
  const OWNER = "owner-uuid";

  beforeEach(() => {
    // Default: a valid owner session — individual cases override as needed.
    process.env.ADMIN_USER_IDS = OWNER;
    getUserResult = { data: { user: { id: OWNER } }, error: null };
  });

  it("404s when ADMIN_USER_IDS is unset/empty (fail closed)", async () => {
    delete process.env.ADMIN_USER_IDS;
    await expect(requireOwner()).rejects.toThrow(NOT_FOUND);
  });

  it("404s when getUser() returns an error", async () => {
    getUserResult = { data: { user: null }, error: { message: "boom" } };
    await expect(requireOwner()).rejects.toThrow(NOT_FOUND);
  });

  it("404s when getUser() returns no user id", async () => {
    getUserResult = { data: { user: null }, error: null };
    await expect(requireOwner()).rejects.toThrow(NOT_FOUND);
  });

  it("404s when the user id is not in the allow-list", async () => {
    getUserResult = { data: { user: { id: "intruder-uuid" } }, error: null };
    await expect(requireOwner()).rejects.toThrow(NOT_FOUND);
  });

  it("returns the uid when the user id is in the allow-list", async () => {
    await expect(requireOwner()).resolves.toBe(OWNER);
  });
});
