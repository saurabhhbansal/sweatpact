import { MobileNav, TopNav } from "@/components/nav";

function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-[1rem] bg-white/[0.08] ${className ?? ""}`} />;
}

export default function GroupLoading() {
  return (
    <>
      <TopNav />
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        {/* Back nav row */}
        <Skel className="h-4 w-24 rounded-full" />
        {/* Versus hero card */}
        <Skel className="h-72 rounded-[2rem]" />
        {/* Ledger buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Skel className="h-16 rounded-[1.4rem]" />
          <Skel className="h-16 rounded-[1.4rem]" />
        </div>
        {/* Calendar / progress section */}
        <Skel className="h-52 rounded-[2rem]" />
      </main>
      <MobileNav />
    </>
  );
}
