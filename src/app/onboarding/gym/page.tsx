import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StepIndicator } from "../step-indicator";
import { GymOnboarding } from "./client";
import { SweatPactSeal } from "@/components/sweatpact-seal";

export const dynamic = "force-dynamic";

export default async function GymOnboardingPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, onboarding_complete")
    .eq("id", auth.user.id)
    .single();
  if (!profile) redirect("/login");
  if (!profile.username || /^user_[a-f0-9]{8}$/.test(profile.username)) {
    redirect("/onboarding/username");
  }
  if (profile.onboarding_complete) redirect("/dashboard");

  const { data: gyms } = await supabase
    .from("user_gyms")
    .select("id, name")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true });

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="flex justify-center text-white">
            <SweatPactSeal size="md" />
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Where do you train?</h1>
          <p className="mt-2 text-sm text-white/55">
            Add your gym so check-ins are auto-verified. You can add more later.
          </p>
        </div>
        <StepIndicator current={2} total={4} />
        <Card>
          <CardHeader>
            <CardTitle>Add a gym</CardTitle>
            <CardDescription>Search a place or use your current location.</CardDescription>
          </CardHeader>
          <CardContent>
            <GymOnboarding initialGymCount={gyms?.length ?? 0} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
