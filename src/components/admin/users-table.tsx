import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type UserRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  created_at: string;
  onboarding_complete: boolean;
  weekly_goal: number;
  has_gym: boolean;
  in_pact: boolean;
};

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium " +
        (ok ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/40")
      }
    >
      {label}
    </span>
  );
}

export function UsersTable({ users }: { users: UserRow[] }) {
  return (
    <Card className="rounded-[2rem] glass-card">
      <CardHeader>
        <CardTitle>Registered users ({users.length})</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 pb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.08em] text-white/40">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Registered</th>
              <th className="px-4 py-3">Goal</th>
              <th className="px-4 py-3">Flags</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/5"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{u.name || "(no name)"}</p>
                  {u.username && (
                    <p className="text-xs text-white/40">@{u.username}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-white/70">{u.email}</td>
                <td className="px-4 py-3 text-white/55">
                  {u.created_at.slice(0, 10)}
                </td>
                <td className="px-4 py-3 text-white">
                  {u.weekly_goal}×/wk
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge ok={u.onboarding_complete} label="onboarded" />
                    <Badge ok={u.has_gym} label="gym" />
                    <Badge ok={u.in_pact} label="pact" />
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/40">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
