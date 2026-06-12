
function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-[1rem] bg-white/[0.08] ${className ?? ""}`} />;
}

export default function DashboardLoading() {
  return (
    <>
      <main className="container max-w-md flex min-h-[calc(100dvh-3.5rem-max(env(safe-area-inset-top),0.75rem))] flex-col gap-3 pb-[calc(4.25rem+max(env(safe-area-inset-bottom),20px))] pt-3">
        <Skel className="h-[6.5rem] shrink-0 rounded-[2rem]" />
        <Skel className="min-h-[11rem] flex-1 rounded-[2rem]" />
        <Skel className="h-[6.5rem] shrink-0 rounded-[2rem]" />
        <div className="shrink-0 grid grid-cols-2 gap-3">
          <Skel className="h-[5.5rem] rounded-[1.7rem]" />
          <Skel className="h-[5.5rem] rounded-[1.7rem]" />
        </div>
      </main>
    </>
  );
}
