import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StepIndicator } from "../step-indicator";
import { UsernamePicker } from "./client";

export const dynamic = "force-dynamic";

function isAutoUsername(u: string | null) {
  return !u || /^user_[a-f0-9]{8}$/.test(u);
}

export default async function UsernameOnboarding() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", auth.user.id)
    .single();

  if (profile && !isAutoUsername(profile.username)) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-white/45">SweatPact</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Claim your handle</h1>
          <p className="mt-2 text-sm text-white/55">
            Pick a username. Others will use it to find you and start challenges.
          </p>
        </div>
        <StepIndicator current={0} total={4} />
        <Card>
          <CardHeader>
            <CardTitle>Pick a username</CardTitle>
            <CardDescription>3–20 characters. Letters, numbers, underscores.</CardDescription>
          </CardHeader>
          <CardContent>
            <UsernamePicker />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
