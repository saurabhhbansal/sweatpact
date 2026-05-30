import { MobileNav, TopNav } from "@/components/nav";

function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-xl bg-white/10 ${className ?? ""}`} />;
}

export default function GroupsLoading() {
  return (
    <>
      <TopNav />
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        <div className="space-y-2">
          <Skel className="h-3 w-20 rounded-full" />
          <Skel className="h-8 w-64 rounded-lg" />
          <Skel className="h-3 w-48 rounded-full" />
        </div>
        <div className="space-y-3">
          <Skel className="h-28 rounded-[1rem]" />
          <Skel className="h-28 rounded-[1rem]" />
        </div>
        <div className="space-y-3">
          <Skel className="h-24 rounded-[1rem]" />
          <Skel className="h-24 rounded-[1rem]" />
        </div>
      </main>
      <MobileNav />
    </>
  );
}
