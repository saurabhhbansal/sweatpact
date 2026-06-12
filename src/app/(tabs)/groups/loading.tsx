
function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-[1rem] bg-white/[0.08] ${className ?? ""}`} />;
}

export default function GroupsLoading() {
  return (
    <>
      <main className="container max-w-md space-y-5 pb-28 pt-4">
        {/* Page title */}
        <div className="space-y-2">
          <Skel className="h-3 w-20 rounded-full" />
          <Skel className="h-8 w-52 rounded-full" />
        </div>
        {/* Search section */}
        <Skel className="h-20 rounded-[1.7rem]" />
        {/* Challenge cards */}
        <div className="space-y-3">
          <Skel className="h-36 rounded-[2rem]" />
          <Skel className="h-36 rounded-[2rem]" />
        </div>
      </main>
    </>
  );
}
