import { MobileNav, TopNav } from "@/components/nav";

function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-[1rem] bg-white/[0.08] ${className ?? ""}`} />;
}

export default function DashboardLoading() {
  return (
    <>
      <TopNav />
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        {/* Checkin strip section */}
        <Skel className="h-32 rounded-[2rem]" />
        {/* Today action card — renders before the streak in the common pending case */}
        <Skel className="h-28 rounded-[2rem]" />
        {/* Streak circle section */}
        <Skel className="h-72 rounded-[2rem]" />
        {/* Balance tiles */}
        <div className="grid grid-cols-2 gap-3">
          <Skel className="h-24 rounded-[1.7rem]" />
          <Skel className="h-24 rounded-[1.7rem]" />
        </div>
      </main>
      <MobileNav />
    </>
  );
}
