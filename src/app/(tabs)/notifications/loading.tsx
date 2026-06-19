
function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-[1rem] bg-white/[0.08] ${className ?? ""}`} />;
}

export default function NotificationsLoading() {
  return (
    <>
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        <section className="rounded-[2rem] glass-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skel className="h-4 w-28 rounded-full" />
              <Skel className="h-3 w-44 rounded-full" />
            </div>
            <Skel className="h-9 w-9 shrink-0 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skel className="h-16 rounded-[1.4rem]" />
            <Skel className="h-16 rounded-[1.4rem]" />
            <Skel className="h-16 rounded-[1.4rem]" />
          </div>
        </section>
        <section className="rounded-[2rem] glass-card p-5">
          <div className="mb-4 space-y-2">
            <Skel className="h-4 w-32 rounded-full" />
            <Skel className="h-3 w-48 rounded-full" />
          </div>
          <Skel className="h-16 rounded-[1.4rem]" />
        </section>
      </main>
    </>
  );
}
