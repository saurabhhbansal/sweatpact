import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StepIndicator } from "../step-indicator";
import { ScheduleForm } from "./client";
import { SweatPactSeal } from "@/components/sweatpact-seal";

export const dynamic = "force-dynamic";

export default async function ScheduleOnboarding() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, weekly_goal, rest_days, onboarding_complete")
    .eq("id", auth.user.id)
    .single();
  if (!profile) redirect("/login");
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
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Your schedule</h1>
          <p className="mt-2 text-sm text-white/55">
            How often do you want to hit the gym? You can change this any time.
          </p>
        </div>
        <div className="animate-fade-up-item" style={{ "--stagger": "60ms" } as React.CSSProperties}>
          <StepIndicator current={1} total={4} />
        </div>
        <div className="animate-fade-up-item" style={{ "--stagger": "110ms" } as React.CSSProperties}>
        <Card>
          <CardHeader>
            <CardTitle>Weekly goal & rest days</CardTitle>
            <CardDescription>Penalties apply when you fall short of your goal.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScheduleForm
              initialGoal={profile.weekly_goal ?? 4}
              initialRestDays={Array.isArray(profile.rest_days) ? profile.rest_days : []}
            />
          </CardContent>
        </Card>
        </div>
      </div>
    </main>
  );
}
