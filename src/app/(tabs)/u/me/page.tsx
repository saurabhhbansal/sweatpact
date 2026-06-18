import { redirect } from "next/navigation";
import { getViewerProfile } from "@/lib/supabase/rsc";

export const dynamic = "force-dynamic";

export default async function MyProfileRedirect() {
  const profile = await getViewerProfile();
  if (!profile) redirect("/login");
  if (!profile.username) redirect("/onboarding/username");
  redirect(`/u/${profile.username}`);
}
