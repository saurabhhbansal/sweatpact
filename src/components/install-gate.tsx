"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Platform = "ios" | "android" | "other";

function getStandalone(): boolean {
  if (typeof window === "undefined") return true;
  if ((navigator as { standalone?: boolean }).standalone === true) return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return false;
}

function getPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

// iOS share icon — matches the actual Safari share button glyph.
function IOSShareIcon() {
  return (
    <svg aria-hidden="true" focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block align-text-bottom"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export function InstallGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [standalone, setStandalone] = useState(true);
  const [platform, setPlatform] = useState<Platform>("other");
  const promptRef = useRef<Event & { prompt?: () => Promise<void> } | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    setStandalone(getStandalone());
    setPlatform(getPlatform());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as typeof promptRef.current;
      setCanPrompt(true);
    };
    const onInstalled = () => setStandalone(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Auth routes must stay accessible — email confirmation links open in browser.
  const isAuthRoute = pathname?.startsWith("/auth/");

  if (standalone || isAuthRoute) return <>{children}</>;

  async function handleInstall() {
    if (!promptRef.current?.prompt) return;
    await promptRef.current.prompt();
    promptRef.current = null;
    setCanPrompt(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Wordmark */}
        <div>
          <p className="text-3xl font-bold tracking-tight text-white">SweatPact</p>
          <p className="mt-1 text-sm text-white/45">Gym accountability with real stakes.</p>
        </div>

        {/* Install card */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          {platform === "ios" ? (
            <div className="space-y-5">
              <p className="text-base font-semibold text-white">Add to your Home Screen</p>
              <ol className="space-y-3 text-left text-sm text-white/70">
                <li className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20 text-[10px] font-bold text-white/60">1</span>
                  <span>Tap <IOSShareIcon /> in your browser toolbar</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20 text-[10px] font-bold text-white/60">2</span>
                  <span>Select <strong className="text-white">Add to Home Screen</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20 text-[10px] font-bold text-white/60">3</span>
                  <span>Tap <strong className="text-white">Add</strong> to confirm</span>
                </li>
              </ol>
            </div>
          ) : canPrompt ? (
            <div className="space-y-4">
              <p className="text-base font-semibold text-white">Install SweatPact</p>
              <p className="text-sm text-white/55">Add it to your home screen for the full experience.</p>
              <button
                onClick={handleInstall}
                className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-95"
              >
                Install App
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-base font-semibold text-white">Open on your phone</p>
              <p className="text-sm text-white/55">
                SweatPact is built for mobile. Open this link on your phone to install it.
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-white/25">Free · No ads · Honour system</p>
      </div>
    </div>
  );
}
