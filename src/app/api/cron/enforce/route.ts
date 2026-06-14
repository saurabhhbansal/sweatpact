import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runEnforcement } from "@/lib/enforcement";
import { sendPeriodReminders } from "@/lib/period-notify";

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
  try {
    const result = await runEnforcement(admin, now);
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
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
