"use client";

import { useEffect } from "react";

// global-error replaces the root layout, so it must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Something went wrong</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">The app crashed</h1>
          <p className="mt-3 max-w-sm text-sm text-white/55">
            Try again. If it keeps failing, the error below is what to share:
          </p>
          <pre className="mt-3 max-w-sm overflow-x-auto rounded-xl border border-white/15 bg-white/[0.04] p-3 text-left text-[11px] text-white/65">
            {error.message}
            {error.digest ? `\n(digest ${error.digest})` : ""}
          </pre>
          <button
            type="button"
            onClick={reset}
            className="mt-5 rounded-full border border-white/25 px-5 py-2 text-sm text-white hover:bg-white/[0.06]"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
