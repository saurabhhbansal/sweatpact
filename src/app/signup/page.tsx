"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SweatPactSeal } from "@/components/sweatpact-seal";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, gender },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback?next=/dashboard`
            : undefined,
      },
    });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setMessage("Check your email to confirm and finish signup.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex justify-center text-white">
            <SweatPactSeal size="md" />
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Create account</h1>
          <p className="mt-2 text-sm text-white/55">Set up your profile, then start wiring up your groups.</p>
        </div>
        <Card>
        <CardHeader>
          <CardTitle>Sign up</CardTitle>
          <CardDescription>Fill in your details to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                required
                className="flex h-10 w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2"
                value={gender}
                onChange={(event) => setGender(event.target.value)}
              >
                <option value="" disabled className="text-slate-950">Select gender</option>
                <option value="male" className="text-slate-950">Male</option>
                <option value="female" className="text-slate-950">Female</option>
              </select>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-white/58">{message}</p> : null}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create account"}
            </Button>
            <p className="text-center text-sm text-white/55">
              Already have one?{" "}
              <Link className="underline text-white/74" href="/login">Sign in</Link>
            </p>
          </form>
        </CardContent>
        </Card>
      </div>
    </main>
  );
}
