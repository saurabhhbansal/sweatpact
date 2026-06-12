import { Suspense, cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MobileNav, TopNav } from "@/components/nav";

export const dynamic = "force-dynamic";

// One fetch per request, shared by both nav slots below.
const getNavProfile = cache(async () => {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, username")
    .eq("id", auth.user.id)
    .single();
  if (!profile) redirect("/login");
  return profile;
});

async function TopBar() {
  const profile = await getNavProfile();
  return (
    <TopNav
      name={profile.name?.trim() || profile.email || "Account"}
      username={profile.username}
    />
  );
}

async function BottomBar() {
  const profile = await getNavProfile();
  return <MobileNav username={profile.username ?? undefined} />;
}

// Shared layout for all signed-in tab routes. Rendering the navs here (instead
// of per page) keeps them mounted across client navigations, so the bottom
// nav's sliding indicator actually glides between tabs. The navs are streamed
// behind Suspense with prop-less navs as the instant fallback, so the shell
// paints on hard loads without waiting for the profile fetch.
export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<TopNav />}>
        <TopBar />
      </Suspense>
      {children}
      <Suspense fallback={<MobileNav />}>
        <BottomBar />
      </Suspense>
    </>
  );
}
