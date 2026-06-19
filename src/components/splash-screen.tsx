"use client";

import { useEffect, useState } from "react";

// Shows once per browser session (sessionStorage gate). Renders nothing on
// the server — the overlay only mounts after hydration, which is fast enough
// for a PWA cold-boot. Three-phase lifecycle:
//   hidden → in (entrance animations run) → out (fade-out) → hidden (unmount)
export function SplashScreen() {
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");

  useEffect(() => {
    if (sessionStorage.getItem("sp_splash_v1")) return;
    setPhase("in");
    const t1 = setTimeout(() => setPhase("out"), 1100);
    const t2 = setTimeout(() => {
      setPhase("hidden");
      sessionStorage.setItem("sp_splash_v1", "1");
    }, 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      style={{
        opacity: phase === "out" ? 0 : 1,
        transition: phase === "out" ? "opacity 420ms cubic-bezier(0.4, 0, 1, 1)" : "none",
        pointerEvents: phase === "out" ? "none" : "auto",
      }}
    >
      {/* Atmospheric glow — very faint, adds depth without noise */}
      <div
        aria-hidden="true"
        className="animate-splash-glow pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(255,255,255,0.055) 0%, transparent 100%)",
        }}
      />

      {/* Wordmark */}
      <div className="relative flex w-64 flex-col items-stretch">
        <span className="animate-splash-top block text-center font-extrabold tracking-[0.05em] text-white"
              style={{ fontSize: "clamp(2.2rem, 13vw, 3.8rem)" }}>
          SWEAT
        </span>

        {/* Divider — expands from center, mirrors the icon.svg horizontal rule */}
        <div className="animate-splash-line my-[0.45em] h-[2.5px] w-full origin-center bg-white" />

        <span className="animate-splash-bottom block text-center font-extrabold tracking-[0.05em] text-white"
              style={{ fontSize: "clamp(2.2rem, 13vw, 3.8rem)" }}>
          PACT
        </span>
      </div>
    </div>
  );
}
