import { MobileNav, TopNav } from "@/components/nav";

function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-xl bg-white/10 ${className ?? ""}`} />;
}

export default function GroupLoading() {
  return (
    <>
      <TopNav />
      <main className="animate-fade-up container max-w-md space-y-4 pb-28 pt-4">
        <Skel className="h-32 rounded-[1rem]" />
        <Skel className="h-48 rounded-[1rem]" />
        <Skel className="h-48 rounded-[1rem]" />
        <Skel className="h-36 rounded-[1rem]" />
      </main>
      <MobileNav />
    </>
  );
}
