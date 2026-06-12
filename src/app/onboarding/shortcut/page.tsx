import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyField } from "@/app/(tabs)/shortcut/client";
import { StepIndicator } from "../step-indicator";
import { FinishOnboardingButtons } from "./client";
import { SweatPactSeal } from "@/components/sweatpact-seal";

export const dynamic = "force-dynamic";

const GYM_SHORTCUT_URL = "https://www.icloud.com/shortcuts/e8ad937c480b4a4ea5f34dd4d8475b71";

export default async function ShortcutOnboarding() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, onboarding_complete")
    .eq("id", auth.user.id)
    .single();
  if (!profile) redirect("/login");

  const { data: secretRow } = await supabase
    .from("profile_secrets")
    .select("webhook_secret")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const webhookSecret = secretRow?.webhook_secret ?? "";
  if (!profile.username || /^user_[a-f0-9]{8}$/.test(profile.username)) {
    redirect("/onboarding/username");
  }
  if (profile.onboarding_complete) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="animate-fade-up-item mb-6 text-center">
          <div className="flex justify-center text-white">
            <SweatPactSeal size="md" />
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">iOS Shortcut</h1>
          <p className="mt-2 text-sm text-white/55">
            Optional. Auto-check-in when you arrive at the gym. iPhone only.
          </p>
        </div>
        <div className="animate-fade-up-item" style={{ "--stagger": "60ms" } as React.CSSProperties}>
          <StepIndicator current={3} total={4} />
        </div>
        <div className="animate-fade-up-item" style={{ "--stagger": "110ms" } as React.CSSProperties}>
        <Card>
          <CardHeader>
            <CardTitle>One-tap install</CardTitle>
            <CardDescription>
              The Shortcut asks for your User ID and Secret on import — copy from below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-[1.4rem] glass-card p-4">
              <p className="text-xs text-white/50">
                Copy these — the Shortcut will ask for them on install.
              </p>
              <CopyField label="User ID" value={profile.id} />
              <CopyField label="Secret Key" value={webhookSecret} hidden />
            </div>
            <a
              href={GYM_SHORTCUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              <Download className="h-4 w-4" />
              Install Gym Check-in Shortcut
            </a>
            <p className="text-xs text-white/50">
              After installing, set up an <strong>Arrive</strong> automation in
              the Shortcuts app pointing at your gym. Step-by-step screenshots
              are in the{" "}
              <Link href="/shortcut" className="underline text-white/75">
                full setup guide
              </Link>
              .
            </p>
            <FinishOnboardingButtons />
          </CardContent>
        </Card>
        </div>
      </div>
    </main>
  );
}
