import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MobileNav, TopNav } from "@/components/nav";

export const dynamic = "force-dynamic";

// Shared layout for all signed-in tab routes. Rendering the navs here (instead
// of per page) keeps them mounted across client navigations, so the bottom
// nav's sliding indicator actually glides between tabs.
export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, username")
    .eq("id", auth.user.id)
    .single();
  if (!profile) redirect("/login");

  return (
    <>
      <TopNav
        name={profile.name || profile.email || "Account"}
        username={profile.username}
      />
      {children}
      <MobileNav username={profile.username ?? undefined} />
    </>
  );
}
