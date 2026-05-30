import { MobileNav, TopNav } from "@/components/nav";

function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-xl bg-white/10 ${className ?? ""}`} />;
}

export default function SettingsLoading() {
  return (
    <>
      <TopNav />
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        <div className="rounded-[1rem] border border-white/15 p-5 space-y-4">
          <Skel className="h-5 w-32 rounded-full" />
          <div className="space-y-3">
            <Skel className="h-10 rounded-lg" />
            <Skel className="h-10 rounded-lg" />
            <Skel className="h-10 rounded-lg" />
            <Skel className="h-10 rounded-lg" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Skel key={n} className="h-9 w-9 rounded-full" />
            ))}
          </div>
          <Skel className="h-10 rounded-full" />
        </div>
        <Skel className="h-24 rounded-[1rem]" />
        <Skel className="h-24 rounded-[1rem]" />
      </main>
      <MobileNav />
    </>
  );
}
