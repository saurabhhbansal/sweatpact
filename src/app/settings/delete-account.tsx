"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteAccountButton({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ready = confirmation.trim().toLowerCase() === username.toLowerCase();

  async function doDelete() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      setErr(data.error ?? "Failed to delete account.");
      return;
    }
    // Hard reload to clear any cached session state.
    window.location.href = "/login";
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        className="rounded-full"
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        Delete account
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (busy) return;
          setOpen(v);
          if (!v) {
            setConfirmation("");
            setErr(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your profile, check-ins, challenges, and
              all settled obligations. If you own challenges, an admin or the
              oldest member becomes the new owner so the challenge survives.
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            <p className="text-xs text-white/55">
              Type your username <span className="font-mono text-white">@{username}</span> to confirm.
            </p>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={username}
              autoComplete="off"
              autoFocus
              disabled={busy}
            />
            {err ? <p className="text-xs text-white/85">{err}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={doDelete}
              disabled={busy || !ready}
            >
              {busy ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
