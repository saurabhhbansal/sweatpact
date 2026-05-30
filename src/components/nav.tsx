"use client";

import Link from "next/link";
import {
  Bell,
  CalendarCheck2,
  ChevronDown,
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

type NavLink = {
  href: string;
  label: string;
  icon: typeof CalendarCheck2;
  matchPrefix?: string;
};

const LINKS: NavLink[] = [
  { href: "/dashboard", label: "Today", icon: CalendarCheck2 },
  { href: "/groups", label: "Challenges", icon: Users2 },
  { href: "/u/me", label: "Profile", icon: UserIcon, matchPrefix: "/u/" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3">
      <div className="container mx-auto grid max-w-md grid-cols-3 rounded-[1.9rem] border border-white/18 bg-white/[0.08] p-1 backdrop-blur-2xl">
        {LINKS.map((link) => {
          const active = link.matchPrefix
            ? pathname?.startsWith(link.matchPrefix)
            : pathname === link.href || pathname?.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative flex min-h-[4.3rem] flex-col items-center justify-center gap-1 rounded-[1.4rem] text-[11px] transition-all duration-200",
                active
                  ? "text-white"
                  : "text-white/45 hover:bg-white/[0.06] hover:text-white/80"
              )}
            >
              {active && (
                <span className="absolute top-2 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-white" />
              )}
              <Icon className="h-[18px] w-[18px]" />
              <span className={cn("font-medium", active && "font-semibold")}>{link.label}</span>
            </Link>
          );
        })}
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
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="container mx-auto flex h-14 max-w-md items-center justify-between rounded-[1.8rem] border border-white/18 bg-white/[0.08] px-4 backdrop-blur-2xl">
        <Link href="/dashboard" className="text-sm font-semibold tracking-[0.14em] text-white">
          SweatPact
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          {name ? (
            <DropdownMenu>
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
