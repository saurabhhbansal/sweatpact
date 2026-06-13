function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-[1rem] bg-white/[0.08] ${className ?? ""}`} />;
}

export default function ProfileLoading() {
  return (
    <>
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        {/* Combined identity + streak/this-week card */}
        <div className="rounded-[2rem] glass-card p-5">
          <div className="flex items-center gap-4">
            <Skel className="h-20 w-20 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skel className="h-5 w-32 rounded-full" />
              <Skel className="h-3.5 w-24 rounded-full" />
              <Skel className="h-3 w-20 rounded-full" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <div className="space-y-2">
              <Skel className="h-3 w-16 rounded-full" />
              <Skel className="h-7 w-14 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skel className="h-3 w-16 rounded-full" />
              <Skel className="h-7 w-14 rounded-full" />
            </div>
          </div>
        </div>
        {/* Activity */}
        <Skel className="h-40 rounded-[2rem]" />
        {/* Gyms / settings */}
        <Skel className="h-28 rounded-[2rem]" />
      </main>
    </>
  );
}
