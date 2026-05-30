import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyField } from "@/app/shortcut/client";
import { StepIndicator } from "../step-indicator";
import { FinishOnboardingButtons } from "./client";

export const dynamic = "force-dynamic";

const SHORTCUT_URL = "https://www.icloud.com/shortcuts/e8ad937c480b4a4ea5f34dd4d8475b71";

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
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">SweatPact</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">iOS Shortcut</h1>
          <p className="mt-2 text-sm text-white/55">
            Optional. Auto-check-in when you arrive at the gym. iPhone only.
          </p>
        </div>
        <StepIndicator current={3} total={4} />
        <Card>
          <CardHeader>
            <CardTitle>One-tap install</CardTitle>
            <CardDescription>
              The Shortcut asks for your User ID and Secret on import — copy from below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <a
              href={SHORTCUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              <Download className="h-4 w-4" />
              Install SweatPact Shortcut
            </a>
            <div className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.02] p-4">
              <CopyField label="User ID" value={profile.id} />
              <CopyField label="Secret Key" value={webhookSecret} hidden />
            </div>
            <p className="text-xs text-white/55">
              After install, go to Shortcuts → Automation → New Personal Automation → <em>Arrive</em> at your gym → run <em>SweatPact Check In</em>.
            </p>
            <FinishOnboardingButtons />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
