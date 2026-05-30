import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SweatPact",
  description: "Commit to the gym. Pay your crew when you skip.",
  manifest: "/manifest.webmanifest",
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
        {children}
      </body>
    </html>
  );
}
