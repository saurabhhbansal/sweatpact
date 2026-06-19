import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UsernamePicker } from "./client";
import { SweatPactSeal } from "@/components/sweatpact-seal";

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
        <div className="animate-fade-up-item mb-6 text-center">
          <div className="flex justify-center text-white">
            <SweatPactSeal size="md" />
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Claim your handle</h1>
          <p className="mt-2 text-sm text-white/55">
            Pick a username. Others will use it to find you and start challenges.
          </p>
        </div>
        <div className="animate-fade-up-item" style={{ "--stagger": "110ms" } as React.CSSProperties}>
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
      </div>
    </main>
  );
}
