import { MobileNav, TopNav } from "@/components/nav";

function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-[1rem] bg-white/[0.08] ${className ?? ""}`} />;
}

export default function CycleLoading() {
  return (
    <>
      <TopNav />
      <main className="container max-w-md space-y-5 pb-28 pt-4">
        {/* Page title */}
        <div className="space-y-2">
          <Skel className="h-3 w-20 rounded-full" />
          <Skel className="h-8 w-48 rounded-full" />
        </div>
        {/* Next period hero */}
        <Skel className="h-36 rounded-[2rem]" />
        {/* Date strip */}
        <Skel className="h-16 rounded-[2rem]" />
        {/* Log section */}
        <Skel className="h-28 rounded-[2rem]" />
        {/* Highlights grid */}
        <div className="grid grid-cols-2 gap-3">
          <Skel className="h-24 rounded-[1.7rem]" />
          <Skel className="h-24 rounded-[1.7rem]" />
          <Skel className="h-24 rounded-[1.7rem]" />
          <Skel className="h-24 rounded-[1.7rem]" />
        </div>
        {/* Trends */}
        <Skel className="h-48 rounded-[2rem]" />
      </main>
      <MobileNav />
    </>
  );
}
