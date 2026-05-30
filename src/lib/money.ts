const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCents(cents: number): string {
  return inrFormatter.format((Number(cents) || 0) / 100);
}

export function rupeesToCents(input: string | number): number {
  const n = typeof input === "string" ? Number(input) : input;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
