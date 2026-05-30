"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

export function CopyField({
  label,
  value,
  hidden = false,
}: {
  label: string;
  value: string;
  hidden?: boolean;
}) {
  const [shown, setShown] = useState(!hidden);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-[0.16em] text-white/55">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2">
        <span className="flex-1 truncate font-mono text-xs text-white/90">
          {shown ? value : "•".repeat(Math.min(value.length, 16))}
        </span>
        {hidden ? (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide" : "Show"}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.08] hover:text-white"
          >
            {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        ) : null}
        <button
          type="button"
          onClick={copy}
          aria-label="Copy"
          className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[0.08] hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-white" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
