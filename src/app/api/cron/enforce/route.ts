import { NextRequest, NextResponse } from "next/server";
import { PostHog } from "posthog-node";
import { createAdminClient } from "@/lib/supabase/admin";
import { runEnforcement } from "@/lib/enforcement";
import { sendPeriodReminders } from "@/lib/period-notify";
import { EVENT } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Verify the request comes from Vercel Cron (which sets a Bearer header
// with our CRON_SECRET) or from a manual ping with the same secret.
function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const now = new Date();
  const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "", {
    host: "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  try {
    const result = await runEnforcement(admin, now);
    for (const userId of result.penalized_user_ids) {
      posthog.capture({ distinctId: userId, event: EVENT.FINANCIAL_PENALTY_ISSUED });
    }
    // Period reminders are non-critical — a failure here must not abort the run
    // or mask the enforcement result.
    try {
      await sendPeriodReminders(admin, now);
    } catch (err) {
      console.error("[cron] period reminders failed:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ ok: result.errors === 0, ...result });
  } catch (err) {
    console.error("[cron] enforcement run failed:", err instanceof Error ? err.stack ?? err.message : err);
    return NextResponse.json(
      { error: "enforcement_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  } finally {
    await posthog.shutdown();
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
