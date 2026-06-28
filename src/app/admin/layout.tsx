import { requireOwner } from "@/lib/admin-auth";

// Standalone owner-gated admin shell (ADMIN-01, ADMIN-02). DELIBERATELY DIVERGES
// from src/app/(tabs)/layout.tsx: no TourProvider, no MobileNav/TopNav, no tab
// chrome — just a minimal fixed header on the same SweatPact brand tokens. The
// FIRST statement is `await requireOwner()`, so a non-owner gets notFound() (404)
// before any markup renders and before the page can fetch cross-user data.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwner(); // 404s for non-owners — must run before any JSX

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 flex h-14 items-center justify-between border-b border-white/10 bg-black/80 px-4 backdrop-blur">
        <span className="text-sm font-semibold text-white">SweatPact Admin</span>
        <a href="/" className="text-sm text-white/55 hover:text-white">
          Back to app
        </a>
      </header>
      {/* Reserve the fixed header's height (h-14 = 3.5rem) so content starts below it. */}
      <div style={{ height: "3.5rem" }} aria-hidden="true" />
      <main className="container max-w-5xl py-6">{children}</main>
    </>
  );
}
