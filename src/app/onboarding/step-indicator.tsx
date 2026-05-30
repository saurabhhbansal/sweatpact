export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all ${
            i === current
              ? "w-10 bg-white"
              : i < current
                ? "w-6 bg-white/45"
                : "w-6 bg-white/12"
          }`}
        />
      ))}
      <span className="ml-2 text-xs uppercase tracking-[0.16em] text-white/55">
        Step {current + 1} of {total}
      </span>
    </div>
  );
}
