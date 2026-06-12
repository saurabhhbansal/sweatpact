
function Skel({ className }: { className?: string }) {
  return <div className={`animate-skeleton rounded-[1rem] bg-white/[0.08] ${className ?? ""}`} />;
}

function SkeletonRow() {
  return <Skel className="h-14 rounded-[1.4rem]" />;
}

function SkeletonSectionLabel() {
  return <Skel className="h-2.5 w-24 rounded-full" />;
}

export default function SettingsLoading() {
  return (
    <>
      <main className="container max-w-md space-y-4 pb-28 pt-4">
        <section className="rounded-[2rem] glass-card p-5">
          {/* Title */}
          <div className="mb-5 space-y-1.5">
            <Skel className="h-5 w-24 rounded-full" />
            <Skel className="h-3.5 w-40 rounded-full" />
          </div>
          <div className="space-y-6">
            {/* Profile row */}
            <SkeletonRow />

            {/* Gyms */}
            <SkeletonSectionLabel />
            <div className="space-y-2">
              <SkeletonRow />
              <SkeletonRow />
            </div>

            {/* App Setup */}
            <SkeletonSectionLabel />
            <SkeletonRow />

            {/* Notifications */}
            <SkeletonSectionLabel />
            <div className="space-y-2">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>

            {/* Account */}
            <SkeletonSectionLabel />
            <SkeletonRow />
          </div>
        </section>
      </main>
    </>
  );
}
