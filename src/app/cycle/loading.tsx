import { MobileNav, TopNav } from "@/components/nav";

function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-xl bg-white/10 ${className ?? ""}`} />;
}

export default function CycleLoading() {
  return (
    <>
      <TopNav />
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        <Skel className="h-16 rounded-[1.5rem]" />
        <Skel className="h-36 rounded-[2rem]" />
        <Skel className="h-24 rounded-[2rem]" />
        <div className="grid grid-cols-2 gap-3">
          <Skel className="h-24 rounded-[1.7rem]" />
          <Skel className="h-24 rounded-[1.7rem]" />
          <Skel className="h-24 rounded-[1.7rem]" />
          <Skel className="h-24 rounded-[1.7rem]" />
        </div>
        <Skel className="h-64 rounded-[2rem]" />
      </main>
      <MobileNav />
    </>
  );
}
