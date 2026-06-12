import { redirect } from "next/navigation";
import { getAuthUser, getSupabaseRSC } from "@/lib/supabase/rsc";

export const dynamic = "force-dynamic";

export default async function MyProfileRedirect() {
  const supabase = getSupabaseRSC();
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, onboarding_complete")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  if (!profile.username || /^user_[a-f0-9]{8}$/.test(profile.username)) {
    redirect("/onboarding/username");
  }
  if (!profile.onboarding_complete) {
    redirect("/onboarding/schedule");
  }
  redirect(`/u/${profile.username}`);
}
