import { cn } from "@/lib/utils";

const SIZE_MAP = {
  sm: { box: "h-9 w-9", text: "text-sm" },
  md: { box: "h-12 w-12", text: "text-base" },
  lg: { box: "h-20 w-20", text: "text-2xl" },
} as const;

export function Avatar({
  url,
  name,
  username,
  size = "sm",
  className,
}: {
  url?: string | null;
  name?: string | null;
  username?: string | null;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}) {
  const sizes = SIZE_MAP[size];
  const initial = (name?.trim()?.charAt(0) || username?.charAt(0) || "?").toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/[0.08] font-bold text-white",
        sizes.box,
        sizes.text,
        className
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={username ? `@${username}` : name ?? ""}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
