import type { SupabaseClient } from "@supabase/supabase-js";
import type { Group, GroupMember } from "@/lib/types";

export type GroupRole = GroupMember["role"];

export type MembershipWithGroup = GroupMember & {
  group: Group | null;
};

export function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export function isManagerRole(role: string | null | undefined): role is "owner" | "admin" {
  return role === "owner" || role === "admin";
}

export async function listUserMemberships(
  client: SupabaseClient,
  userId: string
): Promise<MembershipWithGroup[]> {
  const { data, error } = await client
    .from("group_members")
    .select(
      "group_id, user_id, role, penalty_cents, joined_at, groups(id, name, description, owner_id, default_penalty_cents, invite_code, checkin_notifications, created_at)"
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    group_id: row.group_id,
    user_id: row.user_id,
    role: row.role,
    penalty_cents: row.penalty_cents,
    joined_at: row.joined_at,
    group: normalizeRelation<Group>(row.groups),
  }));
}

export async function getMembership(
  client: SupabaseClient,
  userId: string,
  groupId: string
): Promise<MembershipWithGroup | null> {
  const { data, error } = await client
    .from("group_members")
    .select(
      "group_id, user_id, role, penalty_cents, joined_at, groups(id, name, description, owner_id, default_penalty_cents, invite_code, checkin_notifications, created_at)"
    )
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    group_id: data.group_id,
    user_id: data.user_id,
    role: data.role,
    penalty_cents: data.penalty_cents,
    joined_at: data.joined_at,
    group: normalizeRelation<Group>((data as any).groups),
  };
}

export async function getUserGroupIds(
  client: SupabaseClient,
  userId: string
): Promise<string[]> {
  const memberships = await listUserMemberships(client, userId);
  return memberships.map((membership) => membership.group_id);
}
