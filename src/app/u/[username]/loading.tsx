import { MobileNav, TopNav } from "@/components/nav";

function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-[1rem] bg-white/[0.08] ${className ?? ""}`} />;
}

export default function ProfileLoading() {
  return (
    <>
      <TopNav />
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        {/* Profile header card */}
        <Skel className="h-56 rounded-[2rem]" />
        {/* Progress / streak section */}
        <Skel className="h-32 rounded-[2rem]" />
        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-3">
          <Skel className="h-24 rounded-[1.7rem]" />
          <Skel className="h-24 rounded-[1.7rem]" />
          <Skel className="h-24 rounded-[1.7rem]" />
          <Skel className="h-24 rounded-[1.7rem]" />
        </div>
      </main>
      <MobileNav />
    </>
  );
}
