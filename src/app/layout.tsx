import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { InstallGate } from "@/components/install-gate";
import { SplashScreen } from "@/components/splash-screen";
import { PostHogProvider } from "@/components/posthog-provider";
import { PostHogPageview } from "@/components/posthog-pageview";
import { PostHogIdentity } from "@/components/posthog-identity";

export const metadata: Metadata = {
  title: "SweatPact",
  description: "Commit to the gym. Pay your crew when you skip.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    title: "SweatPact",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Required for env(safe-area-inset-*) to be non-zero on notched iPhones —
  // the bottom nav pads itself with safe-area-inset-bottom.
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <PostHogProvider>
          <Suspense fallback={null}><PostHogPageview /></Suspense>
          <PostHogIdentity />
          <SplashScreen />
          <InstallGate>{children}</InstallGate>
          {/* Dedicated portal target for the coachmark engine (react-joyride
              portalElement, consumed in Plan 03 via document.getElementById).
              Sibling of InstallGate so the overlay renders outside the
              InstallGate/Radix portal subtree. Empty, non-visual container. */}
          <div id="tour-root" />
        </PostHogProvider>
      </body>
    </html>
  );
}
