import { redirect } from "next/navigation";
import { getViewerProfile } from "@/lib/supabase/rsc";

export const dynamic = "force-dynamic";

export default async function MyProfileRedirect() {
  const profile = await getViewerProfile();
  if (!profile) redirect("/login");
  redirect(`/u/${profile.username}`);
}
