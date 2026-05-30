"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rupeesToCents } from "@/lib/money";

export function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [penalty, setPenalty] = useState("50");
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
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed");
      return;
    }
    router.refresh();
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="name">Group name</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="border-white/25 bg-white/10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          className="border-white/25 bg-white/10"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="penalty">Default penalty (₹)</Label>
        <Input
          id="penalty"
          type="number"
          step="0.01"
          min="0"
          className="border-white/25 bg-white/10"
          value={penalty}
          onChange={(e) => setPenalty(e.target.value)}
        />
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <Button type="submit" disabled={busy} className="w-full rounded-full">
        {busy ? "Creating…" : "Create group"}
      </Button>
    </form>
  );
}

export function JoinGroupForm() {
  const router = useRouter();
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
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed");
      return;
    }
    router.refresh();
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="code">Invite code</Label>
        <Input
          id="code"
          required
          className="border-white/25 bg-white/10"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <Button type="submit" disabled={busy} className="w-full rounded-full" variant="secondary">
        {busy ? "Joining…" : "Join group"}
      </Button>
    </form>
  );
}

export function InviteSection({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${inviteCode}`
      : `/join?code=${inviteCode}`;

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-white/20 bg-white/5 p-3 font-mono text-sm break-all text-white">
        {inviteCode}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className=""
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(inviteCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* ignore */
            }
          }}
        >
          {copied ? "Copied!" : "Copy code"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className=""
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* ignore */
            }
          }}
        >
          Copy invite link
        </Button>
      </div>
    </div>
  );
}

export function EditGroupName({ groupId, currentName }: { groupId: string; currentName: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/groups/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ group_id: groupId, name: trimmed }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "Failed");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-white">{name}</span>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-white/40 hover:text-white/70 underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border-white/25 bg-white/10 h-8 text-sm"
          disabled={busy}
          autoFocus
        />
        <Button size="sm" onClick={save} disabled={busy || !name.trim()}>
          {busy ? "…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(currentName); }} disabled={busy}>
          Cancel
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

export function RemoveMemberButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm(`Remove ${name} from the group?`)) return;
    setBusy(true);
    const res = await fetch("/api/groups/remove-member", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setBusy(false);
    if (!res.ok) return;
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="ml-2 text-xs text-destructive/70 hover:text-destructive disabled:opacity-40"
      title={`Remove ${name}`}
    >
      {busy ? "…" : "×"}
    </button>
  );
}

export function LeaveGroupButton({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    if (!confirm("Leave this group?")) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/groups/leave", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "owner_cannot_leave_with_members") {
        setErr("Transfer or remove members before leaving (MVP limit).");
        return;
      }
      setErr(data.error ?? "Failed");
      return;
    }
    router.refresh();
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
        {busy ? "…" : isOwner ? "Delete group" : "Leave group"}
      </Button>
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
    </div>
  );
}
