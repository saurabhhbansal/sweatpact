import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseRSC, getViewerProfile } from "@/lib/supabase/rsc";
import { localDay, normalizeTimeZone } from "@/lib/time";
import { computePeriodStats } from "@/lib/period-stats";
import { buttonVariants } from "@/components/ui/button";
import { CycleView } from "./client";

export const dynamic = "force-dynamic";

export default async function CyclePage() {
  try {
    const supabase = getSupabaseRSC();

    const profile = await getViewerProfile();
    if (!profile) redirect("/login");

    if (profile.gender !== "female") {
      redirect("/dashboard");
    }

    const timezone = normalizeTimeZone(
      typeof profile.timezone === "string" ? profile.timezone : undefined
    );
    const today = localDay(new Date(), timezone);

    const cutoffDate = new Date();
    cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - 12);
    const cutoff = cutoffDate.toISOString().slice(0, 10);

    const { data: periodRecords } = await supabase
      .from("period_records")
      .select("local_day, flow_level")
      .eq("user_id", profile.id)
      .gte("local_day", cutoff)
      .order("local_day", { ascending: true });

    const records = periodRecords ?? [];
    const stats = computePeriodStats(records, today);

    return (
      <>
        <main className="container max-w-md pb-28 pt-4">
          <div className="animate-fade-up-item mb-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Your cycle</p>
            <h1 className="mt-1 text-3xl font-semibold text-white">Cycle Tracking</h1>
          </div>
          <CycleView today={today} stats={stats} records={records} lastSyncedAt={profile.period_last_synced_at ?? null} />
        </main>
      </>
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
        (error as { digest: string }).digest === "NEXT_NOT_FOUND")
    ) {
      throw error;
    }
    console.error("Cycle page render failed", error);
    return (
      <main className="container max-w-md py-10">
        <section className="rounded-[2rem] glass-card p-5">
          <h1 className="text-base font-semibold text-white">Couldn&apos;t load your cycle</h1>
          <p className="mt-1 text-sm text-white/55">
            Please refresh. If it still fails, open Settings and save your timezone.
          </p>
          <div className="mt-4">
            <Link className={buttonVariants({ variant: "outline" })} href="/dashboard">
              Back to dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }
}
