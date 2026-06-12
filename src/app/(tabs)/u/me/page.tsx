import { redirect } from "next/navigation";
import { getViewerProfile } from "@/lib/supabase/rsc";

export const dynamic = "force-dynamic";

export default async function MyProfileRedirect() {
  const profile = await getViewerProfile();
  if (!profile) redirect("/login");
  if (!profile.username || /^user_[a-f0-9]{8}$/.test(profile.username)) {
    redirect("/onboarding/username");
  }
  if (!profile.onboarding_complete) {
    redirect("/onboarding/schedule");
  }
  redirect(`/u/${profile.username}`);
}
