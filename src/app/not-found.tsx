import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Page not found</h1>
      <p className="mt-3 max-w-sm text-sm text-white/55">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
