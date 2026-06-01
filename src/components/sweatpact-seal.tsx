import type React from "react";
import { cn } from "@/lib/utils";

type SealSize = "xl" | "lg" | "md" | "sm" | "xs";

// Per-size spec from the "Stacked Seal" logo system. The rule thickness and the
// vertical gap are hand-tuned per size (smaller seals get proportionally thicker
// rules so the mark holds together down to ~12px), so they live in a table
// rather than a single ratio.
const SEAL: Record<SealSize, { font: number; rule: number; gap: number; tracking: string }> = {
  xl: { font: 88, rule: 4, gap: 14, tracking: "0.05em" },
  lg: { font: 52, rule: 3, gap: 9, tracking: "0.05em" },
  md: { font: 30, rule: 2, gap: 6, tracking: "0.05em" },
  sm: { font: 18, rule: 1.5, gap: 4, tracking: "0.05em" },
  xs: { font: 12, rule: 1, gap: 2.5, tracking: "0.04em" },
};

/**
 * SweatPact "Stacked Seal" wordmark: SWEAT / divider rule / PACT. The rule binds
 * the two words like a sealed agreement. Built from the Monochrome Glass tokens
 * (system sans, 800 weight, uppercase). Colour follows `currentColor`, so set
 * the text colour on a parent — white on dark by default, or wrap in a
 * black-text container for the on-light (inverted) variant.
 */
export function SweatPactSeal({
  size = "md",
  fontSize,
  className,
  ...rest
}: {
  size?: SealSize;
  /** Override only the font-size; rule + gap stay from `size` (matches the
   *  design's nav/icon contexts, which resize the xs seal without re-tuning). */
  fontSize?: number;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const s = SEAL[size];
  return (
    <span
      role="img"
      aria-label="SweatPact"
      className={cn(
        "inline-flex flex-col items-stretch text-center font-extrabold uppercase leading-[0.9]",
        className
      )}
      style={{ fontSize: fontSize ?? s.font, letterSpacing: s.tracking }}
      {...rest}
    >
      <span aria-hidden="true">Sweat</span>
      <span
        aria-hidden="true"
        style={{ height: s.rule, margin: `${s.gap}px 0`, background: "currentColor" }}
      />
      <span aria-hidden="true">Pact</span>
    </span>
  );
}

/**
 * "SP" monogram fallback for favicons and tight spaces where the full seal
 * loses legibility. System sans, 800 weight, tight negative tracking.
 */
export function SweatPactMonogram({
  fontSize = 56,
  className,
}: {
  fontSize?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="SweatPact"
      className={cn("inline-block font-extrabold leading-none", className)}
      style={{ fontSize, letterSpacing: "-0.05em" }}
    >
      SP
    </span>
  );
}
