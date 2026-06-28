import "server-only";

// Parse the comma-separated ADMIN_USER_IDS env var into a trimmed allow-list.
// Pure: the raw string is a parameter — no env read here. Missing/empty/whitespace
// input yields [] so the owner gate fails closed (RESEARCH Pitfall 4).
export function parseAdminUserIds(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
