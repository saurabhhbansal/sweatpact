import { PostHog } from "posthog-node";
import type { EventName } from "@/lib/analytics/events";

/**
 * Emit a typed server-side PostHog event.
 *
 * - Creates a new PostHog instance per call (stateless, safe for serverless — no module-level singleton).
 * - flushAt: 1 + flushInterval: 0 flush the event immediately in one HTTP call.
 * - Calls await client.shutdown() for synchronous flush before the function returns.
 * - Silent try-catch: analytics failures must never surface into business logic.
 * - Returns early (no-op) when NEXT_PUBLIC_POSTHOG_KEY is not set (test/CI environments).
 *
 * SECURITY: properties must contain only UUIDs and enum/constant values — never email,
 * name, location coordinates, or any PII (T-08-01-01).
 */
export async function captureServerEvent(
  distinctId: string,
  event: EventName,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) return; // no-op if not configured (test/CI environments)

    // NEXT_PUBLIC_POSTHOG_HOST is '/ingest' (browser reverse proxy) — not valid for
    // server-to-server calls. Hardcode the direct EU PostHog ingestion endpoint
    // confirmed via next.config.mjs rewrites (eu.i.posthog.com).
    const host = "https://eu.i.posthog.com";

    const client = new PostHog(apiKey, {
      host,
      flushAt: 1,       // flush after every event (serverless: no batching delay)
      flushInterval: 0, // disable interval-based flush
    });

    client.capture({ distinctId, event, properties });
    await client.shutdown(); // flush synchronously before function returns
  } catch {
    // Swallow — analytics must never throw into business logic
  }
}
