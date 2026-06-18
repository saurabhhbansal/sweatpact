import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The dashboard "no challenges" empty-state CTA (UX-02). Shown by the dashboard
 * RSC only when the viewer has no active challenges. Brand-voiced,
 * consequence-first copy — never generic/gamified framing (UI-SPEC line 99).
 *
 * Pure presentation: no hooks/handlers, so this is a server component. Mirrors
 * the dashboard "All settled up" card shell.
 */
export function EmptyStatePactCTA() {
  return (
    <div className="animate-fade-up-item shrink-0 rounded-[2rem] glass-card p-4 text-center">
      <p className="text-sm font-semibold text-white">No stakes yet</p>
      <p className="mt-1 text-xs text-white/55">
        Your partner is waiting. Put real money on the line.
      </p>
      <Link
        href="/groups"
        className={cn(buttonVariants(), "mt-3 h-11 w-full")}
      >
        Start your first pact
      </Link>
    </div>
  );
}
