"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rupeesToCents } from "@/lib/money";

export function ChallengeButton({
  targetUserId,
  targetUsername,
  targetName,
}: {
  targetUserId: string;
  targetUsername: string;
  targetName: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("50");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/challenges/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to_user: targetUserId,
        penalty_cents: rupeesToCents(amount),
        message: message.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(
        data.error === "already_pending"
          ? "You already have a pending challenge with this user."
          : data.error === "already_in_challenge"
            ? "You're already in a challenge with this user."
            : data.error === "cannot_challenge_self"
              ? "You can't challenge yourself."
              : data.error ?? "Failed"
      );
      return;
    }
    setSent(true);
    startTransition(() => router.refresh());
  }

  function close() {
    setOpen(false);
    setSent(false);
    setMessage("");
    setErr(null);
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="rounded-full px-6 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
      >
        Challenge @{targetUsername}
      </Button>
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sent ? "Challenge sent" : `Challenge ${targetName}`}
            </DialogTitle>
            <DialogDescription>
              {sent
                ? "They'll get a notification. The challenge starts once they accept."
                : "Set the weekly stake. They'll accept or decline."}
            </DialogDescription>
          </DialogHeader>
          {sent ? (
            <DialogFooter>
              <Button onClick={close} className="rounded-full">
                Done
              </Button>
            </DialogFooter>
          ) : (
            <>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Weekly stake (Rs)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message">Message (optional)</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Let's see who actually shows up."
                    maxLength={200}
                  />
                </div>
                {err ? <p className="text-sm text-destructive">{err}</p> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={close} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={busy}>
                  {busy ? "Sending…" : "Send challenge"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
