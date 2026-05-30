import { MobileNav, TopNav } from "@/components/nav";

function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-xl bg-white/10 ${className ?? ""}`} />;
}

export default function ProfileLoading() {
  return (
    <>
      <TopNav />
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        <Skel className="h-56 rounded-[2rem]" />
        <Skel className="h-32 rounded-[2rem]" />
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
