"use client";

import { Button } from "@/components/ui/button";

// Client route error boundary for the /admin surface. Next.js renders this when
// the layout or page throws an unhandled error during render. Copy matches the
// UI-SPEC Copywriting Contract (whole-page error state) verbatim; the digest is
// never surfaced to the user (no stack trace leak — Security V7 / T-09-16).
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container max-w-5xl py-10">
      <section className="rounded-[2rem] glass-card p-5">
        <h1 className="text-base font-semibold text-white">
          Couldn&apos;t load the admin dashboard
        </h1>
        <p className="mt-1 text-sm text-white/55">
          Refresh, and check that your session is still valid.
        </p>
        <div className="mt-4">
          <Button variant="outline" onClick={() => reset()}>
            Try again
          </Button>
        </div>
      </section>
    </main>
  );
}
