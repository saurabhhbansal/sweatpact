import type { Metadata, Viewport } from "next";
import "./globals.css";
import { InstallGate } from "@/components/install-gate";

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
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen pb-20">
        <InstallGate>{children}</InstallGate>
      </body>
    </html>
  );
}
