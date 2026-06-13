"use client";

import Link from "next/link";
import {
  Bell,
  CalendarCheck2,
  ChevronDown,
  Droplet,
  LogOut,
  Settings2,
  User as UserIcon,
  Users2,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";
import { SweatPactSeal } from "@/components/sweatpact-seal";

type NavLink = {
  href: string;
  label: string;
  icon: typeof CalendarCheck2;
  matchPrefix?: string;
};

function buildLinks(username?: string): NavLink[] {
  return [
    { href: "/dashboard", label: "Dashboard", icon: CalendarCheck2 },
    { href: "/groups", label: "Challenges", icon: Users2 },
    {
      href: username ? `/u/${username}` : "/u/me",
      label: "Profile",
      icon: UserIcon,
      matchPrefix: "/u/",
    },
  ];
}

export function MobileNav({ username }: { username?: string }) {
  const pathname = usePathname();
  const [gender, setGender] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("sp_gender");
  });

  const indicatorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const g: string | null = data.gender ?? null;
        setGender(g);
        if (g) window.localStorage.setItem("sp_gender", g);
        else window.localStorage.removeItem("sp_gender");
      } catch {
        /* ignore */
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const links = buildLinks(username);
  const cycleActive = pathname?.startsWith("/cycle");

  // Which of the three tabs is active (−1 when on a non-tab route, e.g. /cycle).
  const activeIndex = links.findIndex((link) =>
    link.matchPrefix
      ? pathname?.startsWith(link.matchPrefix)
      : pathname === link.href || pathname?.startsWith(`${link.href}/`)
  );

  // Slide the indicator between tabs, stretching from the trailing edge toward
  // the direction of travel. Stretch runs on the independent `scale` property
  // so it composes with the `translate` slide instead of fighting it. The nav
  // stays mounted across tab routes via the (tabs) layout, so this animates
  // on every navigation.
  const prevIndexRef = useRef(activeIndex);
  useEffect(() => {
    const prev = prevIndexRef.current;
    const el = indicatorRef.current;
    if (el && prev !== activeIndex && prev >= 0 && activeIndex >= 0) {
      el.style.transformOrigin = activeIndex > prev ? "left" : "right";
      el.animate?.(
        [{ scale: "1 1" }, { scale: "1.18 1" }, { scale: "1 1" }],
        { duration: 440, easing: "ease" }
      );
    }
    prevIndexRef.current = activeIndex;
  }, [activeIndex]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-black/20 px-3 backdrop-blur-2xl"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
    >
      <div className="container mx-auto flex max-w-md items-center gap-2">

        {/* ── Main 3-tab pill ────────────────────────────────────────────── */}
        <div className="relative grid flex-1 grid-cols-3 rounded-[1.9rem] p-1 glass-liquid bg-white/[0.10]">
          {/* Sliding active-tab indicator — one column wide, inset to match p-1. */}
          <span
            ref={indicatorRef}
            aria-hidden="true"
            className="glass-pill pointer-events-none absolute bottom-1 left-1 top-1 z-0 rounded-[1.65rem]"
            style={{
              width: `calc((100% - 0.5rem) / ${links.length})`,
              translate: `calc(${Math.max(activeIndex, 0)} * 100%) 0`,
              opacity: activeIndex < 0 ? 0 : 1,
            }}
          />
          {/* prefetch={true}: force-dynamic routes otherwise only prefetch the
              loading shell, so every tab switch waits on a full server render.
              Full prefetch makes switches instant; check-in actions call
              router.refresh() so acted-on data never goes stale. */}
          {links.map((link, i) => {
            const active = i === activeIndex;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // iOS-standard tab height ≈ 52 px (was 4.3rem = 69 px — too tall)
                  "group relative z-10 flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-[1.65rem] text-[11px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                  active ? "text-white" : "text-white/55 hover:text-[color:var(--c-action)]"
                )}
              >
                <Icon
                  className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110"
                  aria-hidden="true"
                />
                <span className={cn("font-medium", active && "font-semibold")}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── Cycle circle — female users only ──────────────────────────── */}
        {gender === "female" && (
          <Link
            href="/cycle"
            prefetch={true}
            aria-current={cycleActive ? "page" : undefined}
            className={cn(
              // Outer height matches the pill (3.25rem content + 2×4px p-1 ≈ 3.75rem)
              "group flex h-[3.75rem] w-[3.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-full glass-liquid transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              cycleActive
                ? "glass-pill text-white"
                : "bg-white/[0.08] text-white/55 hover:text-[color:var(--c-action)]"
            )}
          >
            <Droplet
              className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110"
              aria-hidden="true"
            />
            <span className={cn("text-[11px] font-medium", cycleActive && "font-semibold")}>
              Cycle
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}

export function TopNav({
  name,
  username,
}: {
  name?: string;
  username?: string | null;
}) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnread(data.unreadCount ?? 0);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <header
      className="fixed left-0 right-0 top-0 z-40 bg-black/20 px-3 backdrop-blur-2xl"
      style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
    >
      <div className="container mx-auto flex h-14 max-w-md items-center justify-between rounded-[1.8rem] px-4 glass-liquid bg-white/[0.10]">
        <Link
          href="/dashboard"
          aria-label="SweatPact — go to dashboard"
          className="flex items-center text-white"
        >
          <SweatPactSeal size="xs" fontSize={13} />
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            prefetch={true}
            aria-label={unread > 0 ? `Notifications — ${unread} unread` : "Notifications"}
            className="group relative flex h-11 w-11 items-center justify-center rounded-full text-white/70 transition-colors hover:text-[color:var(--c-action)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Bell className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110" />
            {unread > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black"
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>

          {name ? (
            // modal={false} prevents Radix scroll-lock + pointer-events:none
            // on <body> when navigating away mid-transition.
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-white/70 transition-colors hover:text-[color:var(--c-action)]"
                >
                  <span className="max-w-[7rem] truncate">{name}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {username ? `@${username}` : "Signed in"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    handleSignOut();
                  }}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}
