import { createAdminClient } from "@/lib/supabase/admin";
import { UsersTable, type UserRow } from "@/components/admin/users-table";

// Force-dynamic: live service-role query on every request.
// Authorization already enforced in layout.tsx via requireOwner().
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = createAdminClient();

  const [profilesRes, membersRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, name, username, email, created_at, onboarding_complete, weekly_goal, gym_lat")
      .order("created_at", { ascending: false }),
    admin.from("group_members").select("user_id"),
  ]);

  const usersWithPact = new Set(
    ((membersRes.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
  );

  const users: UserRow[] = (
    (profilesRes.data ?? []) as Array<{
      id: string;
      name: string;
      username: string | null;
      email: string;
      created_at: string;
      onboarding_complete: boolean;
      weekly_goal: number;
      gym_lat: number | null;
    }>
  ).map((p) => ({
    id: p.id,
    name: p.name,
    username: p.username,
    email: p.email,
    created_at: p.created_at,
    onboarding_complete: p.onboarding_complete ?? false,
    weekly_goal: p.weekly_goal ?? 4,
    has_gym: p.gym_lat !== null,
    in_pact: usersWithPact.has(p.id),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-base font-semibold text-white">Users</h1>
      <UsersTable users={users} />
    </div>
  );
}
