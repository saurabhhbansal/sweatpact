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
          alt={username ? `@${username}` : name || "User avatar"}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

// Overlapping cluster of avatars (Spotify-blend look). Shows up to `max` faces
// with a ring to separate them, plus a "+N" chip when there are more.
export function AvatarStack({
  members,
  size = "sm",
  max = 3,
  className,
}: {
  members: { url?: string | null; name?: string | null; username?: string | null }[];
  size?: keyof typeof SIZE_MAP;
  max?: number;
  className?: string;
}) {
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;

  return (
    <div className={cn("flex items-center", className)}>
      {shown.map((m, i) => (
        <Avatar
          key={i}
          url={m.url}
          name={m.name}
          username={m.username}
          size={size}
          className={cn(
            "ring-2 ring-black",
            i > 0 && "-ml-3"
          )}
        />
      ))}
      {overflow > 0 ? (
        <div
          className={cn(
            "z-10 -ml-3 flex items-center justify-center rounded-full border border-white/30 bg-white/[0.12] font-semibold text-white ring-2 ring-black",
            SIZE_MAP[size].box,
            SIZE_MAP[size].text
          )}
        >
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}
