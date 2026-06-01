import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { JoinByCode } from "./client";
import { SweatPactSeal } from "@/components/sweatpact-seal";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const code = searchParams.code?.trim() ?? "";

  if (!auth.user) {
    redirect(`/login?next=${encodeURIComponent(`/join?code=${code}`)}`);
  }

  // Pre-look the group up so we can show its name on the confirm screen.
  const { data: group } = await supabase
    .from("groups")
    .select("id, name, description, default_penalty_cents")
    .eq("invite_code", code)
    .maybeSingle();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex justify-center text-white">
            <SweatPactSeal size="md" />
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Join group</h1>
        </div>
        <Card>
        <CardHeader>
          <CardTitle>Join group</CardTitle>
          <CardDescription>
            {group ? `You were invited to ${group.name}.` : "Invite code unknown."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {group ? (
            <JoinByCode code={code} />
          ) : (
            <p className="text-sm text-muted-foreground">
              That invite isn&apos;t valid. Ask for a new code or{" "}
              <Link className="underline text-white/70" href="/groups">
                create your own group
              </Link>
              .
            </p>
          )}
        </CardContent>
        </Card>
      </div>
    </main>
  );
}
