"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CarFront,
  DoorClosed,
  Fingerprint,
  Gauge,
  LogOut,
  ShieldCheck,
  UserRound,
  Wifi,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const features = [
  {
    icon: DoorClosed,
    title: "Gate control",
    description: "Send open or close commands to the garage device over MQTT.",
    accent: "cyan",
  },
  {
    icon: Fingerprint,
    title: "RFID access",
    description: "View the latest card UID read by the access system.",
    accent: "violet",
  },
  {
    icon: Gauge,
    title: "ESP32 health",
    description: "Monitor heap usage, loop load, uptime, and Wi-Fi quality.",
    accent: "emerald",
  },
];

export default function HomePage() {
  const [member, setMember] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    const updateMember = (user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) => {
      if (!active) return;
      const username = user?.user_metadata?.username;
      setMember(user ? (typeof username === "string" && username ? username : user.email || "Member") : null);
      setAuthLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      updateMember(session?.user ?? null);
    });
    void supabase.auth.getSession().then(({ data: { session } }) => updateMember(session?.user ?? null));

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    if (!supabase) return;
    setLoggingOut(true);
    await supabase.auth.signOut();
    setMember(null);
    setLoggingOut(false);
  }

  return (
    <main className="page-enter relative min-h-screen overflow-hidden bg-[#07111e] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_0%,rgba(8,145,178,0.2),transparent_34%),radial-gradient(ellipse_at_90%_30%,rgba(109,40,217,0.14),transparent_38%)]" />

      <header className="relative border-b border-white/[0.07] bg-slate-950/30 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="float-gently grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <DoorClosed size={21} />
            </span>
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">JTD · GARAGE IOT</span>
              <span className="block text-sm font-semibold sm:text-base">Smart Garage</span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a href="#fitur" className="transition hover:text-white">Features</a>
            <a href="#cara-kerja" className="transition hover:text-white">How it works</a>
            <Link href="/simulasi" className="transition hover:text-white">Simulation</Link>
            <Link href="/proposal-guide" className="transition hover:text-white">Proposal guide</Link>
            <Link href="/forum" className="transition hover:text-white">Forum</Link>
          </div>

          <div className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-start sm:gap-2">
            <Link href="/simulasi" className="rounded-xl px-2 py-2 text-xs font-medium text-slate-300 transition hover:text-cyan-200 sm:px-3 sm:text-sm md:hidden">
              Simulation
            </Link>
            <Link href="/proposal-guide" className="rounded-xl px-2 py-2 text-xs font-medium text-slate-300 transition hover:text-cyan-200 sm:px-3 sm:text-sm md:hidden">
              Proposal
            </Link>
            <Link href="/forum" className="rounded-xl px-2 py-2 text-xs font-medium text-slate-300 transition hover:text-cyan-200 sm:px-3 sm:text-sm md:hidden">
              Forum
            </Link>
            <Link href="/panduan" className="rounded-xl px-2 py-2 text-xs font-medium text-cyan-200 transition hover:text-white sm:px-3 sm:text-sm">
              Guide
            </Link>
            {authLoading ? (
              <span className="hidden px-3 py-2 text-xs text-slate-500 sm:inline">Loading account…</span>
            ) : member ? (
              <>
                <span title={member} className="inline-flex max-w-28 items-center gap-1.5 truncate rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-2 text-xs text-emerald-100 sm:max-w-44 sm:px-3 sm:text-sm">
                  <UserRound size={15} className="shrink-0 text-emerald-300" />
                  <span className="truncate">{member}</span>
                </span>
                <Link href="/dashboard" className="hidden rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-white sm:inline-flex sm:px-4">
                  Dashboard
                </Link>
                <button type="button" onClick={handleLogout} disabled={loggingOut} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-2.5 py-2 text-xs font-medium text-slate-300 transition hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50 sm:px-3 sm:text-sm">
                  <LogOut size={15} /> <span className="hidden sm:inline">{loggingOut ? "Signing out…" : "Sign out"}</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="hidden rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-white sm:inline-flex sm:px-4">
                  Sign in
                </Link>
                <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 sm:px-4">
                  Sign up <ArrowUpRight size={15} />
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-xs font-medium text-cyan-100">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            SMART ACCESS SYSTEM · ESP32 + MQTT
          </div>

          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            A secure garage.<br />
            <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-300 bg-clip-text text-transparent">
              Access under control.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            One panel to monitor the gate, RFID access, and ESP32 device health—from your phone or computer.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-xl shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:bg-cyan-300">
              Open dashboard <ArrowRight size={17} />
            </Link>
            <a href="#fitur" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/50 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/70">
              Explore features
            </a>
          </div>

          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-500 sm:text-sm">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-300" /> Member sign-in</span>
            <span className="inline-flex items-center gap-2"><Wifi size={16} className="text-cyan-300" /> Real-time monitoring</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
          <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-cyan-400/10 via-transparent to-violet-500/10 blur-2xl" />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Activity size={18} /></span>
                <div>
                  <p className="text-sm font-semibold">Garage overview</p>
                  <p className="text-xs text-slate-500">Smart access preview</p>
                </div>
              </div>
              <span className="rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">PANEL</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-400/10 to-slate-950/30 p-4 sm:p-5">
                <div className="flex items-center justify-between text-emerald-200"><span className="text-xs text-slate-400">DOOR STATUS</span><DoorClosed size={19} /></div>
                <p className="mt-5 text-xl font-bold tracking-wide sm:text-2xl">CLOSED</p>
                <p className="mt-1 text-xs text-slate-500">Updates with telemetry</p>
              </div>
              <div className="rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-400/10 to-slate-950/30 p-4 sm:p-5">
                <div className="flex items-center justify-between text-violet-200"><span className="text-xs text-slate-400">LATEST ACCESS</span><Fingerprint size={19} /></div>
                <p className="mt-5 truncate text-lg font-semibold sm:text-xl">RFID member</p>
                <p className="mt-1 text-xs text-slate-500">Entry access log</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-gradient-to-r from-cyan-400/[0.08] via-slate-950/30 to-slate-950/30 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">ESP32 MONITORING</p>
                  <p className="mt-1 text-sm font-semibold">Sensors, resources, and connectivity</p>
                </div>
                <div className="flex -space-x-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-900 bg-cyan-300/15 text-cyan-200"><Gauge size={15} /></span>
                  <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-900 bg-amber-300/15 text-amber-200"><Zap size={15} /></span>
                  <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-900 bg-emerald-300/15 text-emerald-200"><Wifi size={15} /></span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-black/20 px-4 py-3 text-xs text-slate-500">
              <span>ESP32 · MQTT · Supabase</span>
              <span className="inline-flex items-center gap-1 text-cyan-200">View dashboard <ArrowRight size={13} /></span>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-4 hidden items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 shadow-xl backdrop-blur-xl sm:flex">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300/10 text-amber-200"><CarFront size={21} /></span>
            <span><span className="block text-xs text-slate-500">PROJECT</span><span className="text-sm font-semibold">Smart Garage JTD</span></span>
          </div>
        </div>
      </section>

      <section id="fitur" className="relative border-y border-white/[0.06] bg-slate-950/25 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-9 flex flex-col gap-3 sm:mb-11 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">ALL IN ONE PANEL</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Clear controls, complete monitoring.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-500">Designed to help team members monitor access and device health in real time.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description, accent }) => (
              <article key={title} className="group rounded-2xl border border-slate-800/90 bg-slate-900/45 p-5 transition hover:-translate-y-1 hover:border-slate-600 hover:bg-slate-900/75 sm:p-6">
                <div className={`mb-5 grid h-11 w-11 place-items-center rounded-xl ${accent === "cyan" ? "bg-cyan-300/10 text-cyan-200" : accent === "violet" ? "bg-violet-300/10 text-violet-200" : "bg-emerald-300/10 text-emerald-200"}`}>
                  <Icon size={21} />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition group-hover:text-cyan-200">Part of the dashboard <ArrowRight size={13} /></span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="cara-kerja" className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">SYSTEM FLOW</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">From device to dashboard, in real time.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">The ESP32 sends sensor readings to the MQTT broker. The dashboard receives telemetry, displays status, and sends gate commands to the selected device.</p>
            <Link href="/signup" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition hover:text-cyan-200">Get started <ArrowRight size={16} /></Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["01", "ESP32", "Sensors and actuators"],
              ["02", "MQTT", "Two-way messaging"],
              ["03", "Dashboard", "Monitor and control"],
            ].map(([number, title, description]) => (
              <article key={number} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                <p className="font-mono text-xs text-cyan-300">/{number}</p>
                <h3 className="mt-7 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/[0.07] bg-slate-950/35">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>© JTD · Smart Garage Control Panel</span>
          <span>ESP32 · EMQX MQTT · Supabase</span>
        </div>
      </footer>
    </main>
  );
}
