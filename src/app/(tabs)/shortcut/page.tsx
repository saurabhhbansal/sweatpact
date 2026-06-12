import type React from "react";
import { redirect } from "next/navigation";
import { getSupabaseRSC, getViewerProfile } from "@/lib/supabase/rsc";
import { ShortcutSetup } from "./client";

export const dynamic = "force-dynamic";

export default async function ShortcutPage() {
  const supabase = getSupabaseRSC();

  const profile = await getViewerProfile();
  if (!profile) redirect("/login");

  const { data: secretRow } = await supabase
    .from("profile_secrets")
    .select("webhook_secret")
    .eq("user_id", profile.id)
    .maybeSingle();
  const webhookSecret = secretRow?.webhook_secret ?? "";

  return (
    <>
      <main className="container max-w-md pb-28 pt-4">
        <div className="animate-fade-up-item mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Setup</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">iOS Shortcuts</h1>
          <p className="mt-1 text-sm text-white/55">
            Automate your check-ins from your iPhone.
          </p>
        </div>
        <div className="animate-fade-up-item" style={{ "--stagger": "70ms" } as React.CSSProperties}>
          <ShortcutSetup
            userId={profile.id}
            webhookSecret={webhookSecret}
            isFemale={profile.gender === "female"}
          />
        </div>
      </main>
    </>
  );
}
