import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileNav, TopNav } from "@/components/nav";
import { CopyField } from "./client";

export const dynamic = "force-dynamic";

const SHORTCUT_URL = "https://www.icloud.com/shortcuts/e8ad937c480b4a4ea5f34dd4d8475b71";

export default async function ShortcutDocs() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", auth.user.id)
    .single();
  if (!profile) redirect("/login");

  const { data: secretRow } = await supabase
    .from("profile_secrets")
    .select("webhook_secret")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const webhookSecret = secretRow?.webhook_secret ?? "";

  return (
    <>
      <TopNav />
      <main className="animate-fade-up container max-w-md space-y-4 pb-28 pt-4">
        <Card>
          <CardHeader>
            <CardTitle>iOS Shortcut setup</CardTitle>
            <CardDescription>
              Auto-check-in when you arrive at the gym. One-tap install — the Shortcut will ask for your User ID and Secret Key during import.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <a
              href={SHORTCUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              <Download className="h-4 w-4" />
              Install SweatPact Shortcut
            </a>
            <p className="text-xs text-white/55">
              Open this page on your iPhone, tap the button above, then in
              Shortcuts tap <strong>Add Shortcut</strong>. When prompted, paste
              the two values below.
            </p>

            <div className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.02] p-4">
              <CopyField label="User ID" value={profile.id} />
              <CopyField label="Secret Key" value={webhookSecret} hidden />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                After install
              </p>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-white/75">
                <li>
                  Open the <strong>Shortcuts</strong> app → <strong>Automation</strong> tab.
                </li>
                <li>
                  New Personal Automation → <em>Arrive</em> at your gym&apos;s location.
                </li>
                <li>
                  Action: run the <em>SweatPact Check In</em> shortcut.
                </li>
                <li>
                  Toggle off <strong>Ask before running</strong> for it to fire silently.
                </li>
              </ol>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Allow untrusted shortcuts
              </p>
              <p className="text-xs text-white/55">
                If the install button does nothing, open <strong>Settings → Shortcuts</strong> and turn on <strong>Allow Untrusted Shortcuts</strong>. Then try again.
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Manual fallback
              </p>
              <p className="text-xs text-white/55">
                If the automation doesn&apos;t fire (Apple sometimes drops them),
                open the app and use{" "}
                <Link className="underline text-white/75" href="/dashboard">
                  Check in
                </Link>
                . Outside-radius attempts go through as <em>unverified</em> so your challenges can review.
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Security
              </p>
              <p className="text-xs text-white/55">
                The Secret Key authenticates this Shortcut. Anyone with the
                Secret can check in as you. Rotate it from{" "}
                <Link className="underline text-white/75" href="/settings">
                  Settings → Advanced
                </Link>
                {" "}if it ever leaks.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
      <MobileNav />
    </>
  );
}
