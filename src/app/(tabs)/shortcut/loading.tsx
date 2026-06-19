
function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-[1rem] bg-white/[0.08] ${className ?? ""}`} />;
}

export default function ShortcutLoading() {
  return (
    <>
      <main className="container max-w-md pb-28 pt-4">
        <div className="mb-6 space-y-2">
          <Skel className="h-2.5 w-12 rounded-full" />
          <Skel className="h-8 w-44 rounded-full" />
          <Skel className="h-3.5 w-56 rounded-full" />
        </div>
        <Skel className="h-64 rounded-[2rem]" />
      </main>
    </>
  );
}
