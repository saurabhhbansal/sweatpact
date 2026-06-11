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
import { useEffect, useState } from "react";
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3">
      <div className="container mx-auto flex max-w-md items-center gap-2">
        {/* Main 3-tab pill */}
        <div className="grid flex-1 grid-cols-3 rounded-[1.9rem] border border-white/18 bg-white/[0.08] p-1 backdrop-blur-2xl">
          {links.map((link) => {
            const active = link.matchPrefix
              ? pathname?.startsWith(link.matchPrefix)
              : pathname === link.href || pathname?.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[4.3rem] flex-col items-center justify-center gap-1 rounded-[1.4rem] text-[11px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                  active
                    ? "bg-white/[0.11] text-white"
                    : "text-white/45 hover:bg-white/[0.06] hover:text-white/80"
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                <span className={cn("font-medium", active && "font-semibold")}>{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Cycle circle — females only */}
        {gender === "female" && (
          <Link
            href="/cycle"
            aria-current={cycleActive ? "page" : undefined}
            className={cn(
              "flex h-[4.8rem] w-[4.8rem] shrink-0 flex-col items-center justify-center gap-1 rounded-full border border-white/18 backdrop-blur-2xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              cycleActive
                ? "bg-white/[0.11] text-white"
                : "bg-white/[0.08] text-white/45 hover:bg-white/[0.11] hover:text-white/80"
            )}
          >
            <Droplet className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className={cn("text-[11px] font-medium", cycleActive && "font-semibold")}>Cycle</span>
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
      // Clear the session client-side so auth cookies are reliably removed,
      // then also hit the server route to clear server-side cookies.
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    } finally {
      // Hard navigation guarantees a fresh, unauthenticated page load.
      window.location.assign("/login");
    }
  }

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="container mx-auto flex h-14 max-w-md items-center justify-between rounded-[1.8rem] border border-white/18 bg-white/[0.08] px-4 backdrop-blur-2xl">
        <Link href="/dashboard" aria-label="SweatPact — go to dashboard" className="flex items-center text-white">
          <SweatPactSeal size="xs" fontSize={13} />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            aria-label={unread > 0 ? `Notifications — ${unread} unread` : "Notifications"}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-white/70 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span aria-hidden="true" className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          {name ? (
            // modal={false} prevents Radix from scroll-locking and setting
            // pointer-events:none on <body>. With modal on, navigating away
            // (Settings / Sign out) unmounts the menu mid-transition before that
            // cleanup runs, leaving the whole page frozen until the next click.
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.06] hover:text-white"
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
