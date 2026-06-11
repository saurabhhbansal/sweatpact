"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <main className="animate-fade-up flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">An unexpected error occurred</h1>
      <p className="mt-3 max-w-sm text-sm text-white/55">
        Try again. If it keeps failing, the error below is what to share:
      </p>
      <pre className="mt-3 max-w-sm overflow-x-auto rounded-xl border border-white/15 bg-white/[0.04] p-3 text-left text-[11px] text-white/65">
        {error.message}
        {error.digest ? `\n(digest ${error.digest})` : ""}
      </pre>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-white/25 px-5 py-2 text-sm text-white hover:bg-white/[0.06]"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
