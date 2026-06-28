import { describe, it, expect } from "vitest";
import { parseAdminUserIds } from "./admin-auth";

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
