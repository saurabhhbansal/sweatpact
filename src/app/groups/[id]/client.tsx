"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Bell, MoreHorizontal, PencilLine, Shield, ShieldCheck, Users, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatCents, rupeesToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type GroupMemberSummary = {
  user_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  role: "owner" | "admin" | "member";
  penalty_cents: number | null;
};

export function CreateGroupForm() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [penalty, setPenalty] = useState("5");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const res = await fetch("/api/groups/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        default_penalty_cents: rupeesToCents(penalty),
      }),
    });

    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(data.error ?? "Failed");
      return;
    }

    router.push(`/groups/${data.group.id}`);
    startTransition(() => router.refresh());
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="name">Group name</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What makes this group tick?"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="penalty">Default penalty (Rs)</Label>
        <Input
          id="penalty"
          type="number"
          step="0.01"
          min="0"
          value={penalty}
          onChange={(e) => setPenalty(e.target.value)}
        />
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Creating..." : "Create group"}
      </Button>
    </form>
  );
}

export function JoinGroupForm() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invite_code: code.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(data.error ?? "Failed");
      return;
    }

    router.push(`/groups/${data.group.id}`);
    startTransition(() => router.refresh());
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="code">Invite code</Label>
        <Input id="code" required value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <Button type="submit" disabled={busy} className="w-full" variant="secondary">
        {busy ? "Joining..." : "Join group"}
      </Button>
    </form>
  );
}

type SearchResult = {
  id: string;
  username: string;
  name: string;
};

export function InviteSection({
  groupId,
  defaultPenaltyCents,
}: {
  groupId: string;
  defaultPenaltyCents: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [amount, setAmount] = useState(((defaultPenaltyCents) / 100).toFixed(2));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.users ?? []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function send() {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/challenges/invite-to-group", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        group_id: groupId,
        to_user: selected.id,
        penalty_cents: rupeesToCents(amount),
        message: message.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(
        data.error === "already_member"
          ? `${selected.name || selected.username} is already in this challenge.`
          : data.error === "already_pending"
            ? "An invitation is already pending."
            : data.error ?? "Failed"
      );
      return;
    }
    setMsg(`Invited @${selected.username}.`);
    setSelected(null);
    setQuery("");
    setMessage("");
  }

  if (selected) {
    return (
      <div className="space-y-3 rounded-2xl border border-white/15 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">{selected.name || `@${selected.username}`}</p>
            <p className="text-xs text-white/45">@{selected.username}</p>
          </div>
          <button
            onClick={() => setSelected(null)}
            className="text-xs text-white/55 hover:text-white"
          >
            Change
          </button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-amount">Weekly stake (Rs)</Label>
          <Input
            id="invite-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-message">Message (optional)</Label>
          <Textarea
            id="invite-message"
            maxLength={200}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Join us, we need a tiebreaker."
          />
        </div>
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        <Button onClick={send} disabled={busy} className="w-full rounded-full">
          {busy ? "Sending…" : "Send invitation"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search username or name…"
          className="border-white/25 bg-white/10"
          autoComplete="off"
        />
      </div>
      {searching ? (
        <p className="text-xs text-white/45">Searching…</p>
      ) : results.length > 0 ? (
        <ul className="divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/15 bg-card/55">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => setSelected(user)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/8"
              >
                <div>
                  <p className="text-sm font-medium text-white">{user.name || `@${user.username}`}</p>
                  <p className="text-xs text-white/45">@{user.username}</p>
                </div>
                <span className="text-xs uppercase tracking-[0.14em] text-white">Invite</span>
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim().length >= 2 ? (
        <p className="text-xs text-white/45">No users found.</p>
      ) : null}
      {msg ? <p className="text-xs text-success">{msg}</p> : null}
    </div>
  );
}

export function GroupManagerMenu({
  groupId,
  currentName,
  defaultPenaltyCents,
  inviteCode,
  checkinNotifications,
  isOwner,
  members,
}: {
  groupId: string;
  currentName: string;
  defaultPenaltyCents: number;
  inviteCode: string;
  checkinNotifications: boolean;
  isOwner: boolean;
  members: GroupMemberSummary[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialog, setDialog] = useState<null | "title" | "amount" | "members" | "admins" | "notifs">(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState(currentName);
  const [amount, setAmount] = useState((defaultPenaltyCents / 100).toFixed(2));
  const [notifsEnabled, setNotifsEnabled] = useState(checkinNotifications);
  const [memberAmounts, setMemberAmounts] = useState<Record<string, string>>(
    Object.fromEntries(
      members.map((member) => [
        member.user_id,
        ((member.penalty_cents ?? defaultPenaltyCents) / 100).toFixed(2),
      ])
    )
  );
  const [error, setError] = useState<string | null>(null);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((left, right) => {
        const rank = { owner: 0, admin: 1, member: 2 };
        return rank[left.role] - rank[right.role] || left.name.localeCompare(right.name);
      }),
    [members]
  );

  async function saveTitle() {
    setBusy("title");
    setError(null);
    const res = await fetch("/api/groups/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ group_id: groupId, name: title.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    setDialog(null);
    startTransition(() => router.refresh());
  }

  async function saveAmount() {
    setBusy("amount");
    setError(null);
    const res = await fetch("/api/groups/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        group_id: groupId,
        default_penalty_cents: rupeesToCents(amount),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    setDialog(null);
    startTransition(() => router.refresh());
  }

  async function saveCheckinNotifications(next: boolean) {
    setBusy("notifs");
    setError(null);
    const prev = notifsEnabled;
    setNotifsEnabled(next);
    const res = await fetch("/api/groups/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ group_id: groupId, checkin_notifications: next }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setNotifsEnabled(prev);
      setError(data.error ?? "Failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function saveMemberAmount(userId: string) {
    setBusy(`member:${userId}`);
    setError(null);
    const res = await fetch("/api/groups/member-penalty", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        group_id: groupId,
        user_id: userId,
        penalty_cents: rupeesToCents(memberAmounts[userId] ?? "0"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function updateRole(userId: string, role: "admin" | "member") {
    setBusy(`role:${userId}`);
    setError(null);
    const res = await fetch("/api/groups/members/role", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ group_id: groupId, user_id: userId, role }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function copyInvite(value: "code" | "link") {
    const text =
      value === "code"
        ? inviteCode
        : `${window.location.origin}/join?code=${inviteCode}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="rounded-full">
            <MoreHorizontal className="h-5 w-5" />
            <span className="sr-only">Open group menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Group tools</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => copyInvite("code")}>Copy invite code</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copyInvite("link")}>Copy invite link</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog("title")}>
            <PencilLine className="mr-2 h-4 w-4" />
            Edit title
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("amount")}>
            <WalletCards className="mr-2 h-4 w-4" />
            Group amount
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("members")}>
            <Users className="mr-2 h-4 w-4" />
            Member amounts
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("notifs")}>
            <Bell className="mr-2 h-4 w-4" />
            Check-in alerts
          </DropdownMenuItem>
          {isOwner ? (
            <DropdownMenuItem onSelect={() => setDialog("admins")}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Admin access
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "title"} onOpenChange={(open) => setDialog(open ? "title" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit group title</DialogTitle>
            <DialogDescription>Rename this group for everyone in it.</DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-2">
            <Label htmlFor="group-title">Title</Label>
            <Input id="group-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={saveTitle} disabled={busy === "title" || !title.trim()}>
              {busy === "title" ? "Saving..." : "Save title"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "amount"} onOpenChange={(open) => setDialog(open ? "amount" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Group weekly stake</DialogTitle>
            <DialogDescription>The fallback weekly stake for members — what they pay any week they miss their goal.</DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-2">
            <Label htmlFor="group-amount">Weekly stake (Rs)</Label>
            <Input
              id="group-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={saveAmount} disabled={busy === "amount"}>
              {busy === "amount" ? "Saving..." : "Save amount"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "notifs"} onOpenChange={(open) => setDialog(open ? "notifs" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check-in alerts</DialogTitle>
            <DialogDescription>
              When on, members get a notification whenever someone in this group checks in.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex items-start justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.02] p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">Notify on check-ins</p>
              <p className="mt-0.5 text-xs text-white/55">Applies to everyone in this challenge.</p>
            </div>
            <button
              type="button"
              onClick={() => saveCheckinNotifications(!notifsEnabled)}
              disabled={busy === "notifs"}
              aria-pressed={notifsEnabled}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
                notifsEnabled ? "border-white bg-white" : "border-white/25 bg-white/[0.06]"
              } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full transition ${
                  notifsEnabled ? "translate-x-6 bg-black" : "translate-x-1 bg-white/70"
                }`}
              />
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "members"} onOpenChange={(open) => setDialog(open ? "members" : null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Member amounts</DialogTitle>
            <DialogDescription>These overrides apply only inside this group.</DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-3">
            {sortedMembers.map((member) => (
              <div
                key={member.user_id}
                className="rounded-[1.4rem] border border-white/15 bg-white/8 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      url={member.avatar_url}
                      name={member.name}
                      username={member.username}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{member.name}</p>
                      <p className="text-xs text-white/50">
                        {member.username ? `@${member.username}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant={member.role === "owner" ? "default" : member.role === "admin" ? "secondary" : "muted"}>
                    {member.role}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={memberAmounts[member.user_id] ?? "0"}
                    onChange={(e) =>
                      setMemberAmounts((current) => ({
                        ...current,
                        [member.user_id]: e.target.value,
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    onClick={() => saveMemberAmount(member.user_id)}
                    disabled={busy === `member:${member.user_id}`}
                  >
                    {busy === `member:${member.user_id}` ? "Saving..." : "Save"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-white/45">
                  Current effective amount: {formatCents(member.penalty_cents ?? defaultPenaltyCents)}
                </p>
              </div>
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "admins"} onOpenChange={(open) => setDialog(open ? "admins" : null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Admin access</DialogTitle>
            <DialogDescription>
              Admins can manage the group, member amounts, removals, and unverified reversals.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-3">
            {sortedMembers
              .filter((member) => member.role !== "owner")
              .map((member) => {
                const makeAdmin = member.role !== "admin";
                return (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between rounded-[1.4rem] border border-white/15 bg-white/8 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        url={member.avatar_url}
                        name={member.name}
                        username={member.username}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-medium text-white">{member.name}</p>
                        <p className="text-xs text-white/50">
                          {member.username ? `@${member.username}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={makeAdmin ? "secondary" : "outline"}
                      onClick={() => updateRole(member.user_id, makeAdmin ? "admin" : "member")}
                      disabled={busy === `role:${member.user_id}`}
                    >
                      {busy === `role:${member.user_id}`
                        ? "Saving..."
                        : makeAdmin
                          ? "Make admin"
                          : "Remove admin"}
                    </Button>
                  </div>
                );
              })}
          </div>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function UpdateMemberRoleButton({
  groupId,
  userId,
  role,
}: {
  groupId: string;
  userId: string;
  role: "owner" | "admin" | "member";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  if (role === "owner") return null;

  async function onClick() {
    setBusy(true);
    const res = await fetch("/api/groups/members/role", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        group_id: groupId,
        user_id: userId,
        role: role === "admin" ? "member" : "admin",
      }),
    });
    setBusy(false);
    if (!res.ok) return;
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="ml-2 inline-flex items-center gap-1 text-xs text-white/55 transition hover:text-white disabled:opacity-40"
    >
      {role === "admin" ? <ShieldCheck className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
      {busy ? "..." : role === "admin" ? "Remove admin" : "Make admin"}
    </button>
  );
}

export function RemoveMemberButton({
  groupId,
  userId,
  name,
}: {
  groupId: string;
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm(`Remove ${name} from this group?`)) return;
    setBusy(true);
    const res = await fetch("/api/groups/remove-member", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ group_id: groupId, user_id: userId }),
    });
    setBusy(false);
    if (!res.ok) return;
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="text-xs text-destructive/75 transition hover:text-destructive disabled:opacity-40"
    >
      {busy ? "Removing..." : "Remove"}
    </button>
  );
}

export function ReverseCheckinButton({
  groupId,
  checkinId,
  memberName,
}: {
  groupId: string;
  checkinId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm(`Reverse ${memberName}'s unverified check-in for this group?`)) return;
    setBusy(true);
    const res = await fetch("/api/groups/checkins/reverse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ group_id: groupId, checkin_id: checkinId }),
    });
    setBusy(false);
    if (!res.ok) return;
    startTransition(() => router.refresh());
  }

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={busy}>
      {busy ? "Reversing..." : "Reverse"}
    </Button>
  );
}

export function LeaveGroupButton({
  groupId,
  isOwner,
}: {
  groupId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    if (!confirm(isOwner ? "Delete this group?" : "Leave this group?")) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/groups/leave", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ group_id: groupId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      if (data.error === "owner_cannot_leave_with_members") {
        setErr("Remove members before deleting this group.");
        return;
      }
      setErr(data.error ?? "Failed");
      return;
    }
    router.push("/groups");
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="destructive"
        className="rounded-full"
        disabled={busy}
        onClick={onClick}
      >
        {busy ? "Working..." : isOwner ? "Delete group" : "Leave group"}
      </Button>
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
    </div>
  );
}
