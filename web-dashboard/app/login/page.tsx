"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import AuthShell from "@/app/components/AuthShell";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setError("Konfigurasi Supabase belum tersedia.");
      setCheckingSession(false);
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session) router.replace("/dashboard");
      setCheckingSession(false);
    });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Konfigurasi Supabase belum tersedia.");
      return;
    }

    setLoading(true);
    setError(null);
    let signInError: Error | null = null;
    if (identifier.trim().includes("@")) {
      const result = await supabase.auth.signInWithPassword({
        email: identifier.trim(),
        password,
      });
      signInError = result.error;
    } else {
      try {
        const response = await fetch("/api/auth/username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: identifier.trim(), password }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Username atau password tidak valid.");
        const { error } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        signInError = error;
      } catch (requestError) {
        signInError = requestError instanceof Error ? requestError : new Error("Login gagal.");
      }
    }

    if (signInError) {
      setError(signInError.message || "Email/username atau password tidak valid.");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      title="Masuk ke dashboard"
      description="Gunakan akun anggota JTD untuk mengakses panel garasi."
      icon={LockKeyhole}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="identifier" className="mb-2 block text-sm font-medium text-slate-300">Email atau username</label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="nama@kampus.ac.id atau username"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/10"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">Password</label>
            <Link href="/forgot-password" className="text-xs text-cyan-300 transition hover:text-cyan-200">
              Lupa password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Masukkan password"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/10"
          />
        </div>

        {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

        <button
          type="submit"
          disabled={loading || checkingSession || !supabase}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Memeriksa akun..." : "Masuk"}
          {!loading && <ArrowRight size={17} />}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        Belum punya akun? <Link href="/signup" className="font-semibold text-cyan-300 hover:text-cyan-200">Daftar</Link>
      </p>
    </AuthShell>
  );
}
