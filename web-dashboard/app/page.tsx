import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CarFront,
  DoorClosed,
  Fingerprint,
  Gauge,
  ShieldCheck,
  Wifi,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: DoorClosed,
    title: "Kontrol gerbang",
    description: "Kirim perintah buka atau tutup ke perangkat garasi lewat MQTT.",
    accent: "cyan",
  },
  {
    icon: Fingerprint,
    title: "Akses RFID",
    description: "Pantau UID kartu terakhir yang terbaca oleh sistem akses.",
    accent: "violet",
  },
  {
    icon: Gauge,
    title: "Kesehatan ESP32",
    description: "Lihat pemakaian heap, beban loop, uptime, dan kualitas Wi-Fi.",
    accent: "emerald",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111e] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_0%,rgba(8,145,178,0.2),transparent_34%),radial-gradient(ellipse_at_90%_30%,rgba(109,40,217,0.14),transparent_38%)]" />

      <header className="relative border-b border-white/[0.07] bg-slate-950/30 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <DoorClosed size={21} />
            </span>
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">JTD · GARAGE IOT</span>
              <span className="block text-sm font-semibold sm:text-base">Smart Garage</span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a href="#fitur" className="transition hover:text-white">Fitur</a>
            <a href="#cara-kerja" className="transition hover:text-white">Cara kerja</a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-white sm:px-4">
              Masuk
            </Link>
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 sm:px-4">
              Daftar <ArrowUpRight size={15} />
            </Link>
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
            SISTEM AKSES PINTAR · ESP32 + MQTT
          </div>

          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Garasi aman.<br />
            <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-300 bg-clip-text text-transparent">
              Akses dalam kendali.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Satu panel untuk memantau gerbang, akses RFID, dan kondisi perangkat ESP32—dari ponsel maupun komputer.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-xl shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:bg-cyan-300">
              Buka dashboard <ArrowRight size={17} />
            </Link>
            <a href="#fitur" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/50 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/70">
              Kenali fiturnya
            </a>
          </div>

          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-500 sm:text-sm">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-300" /> Login anggota</span>
            <span className="inline-flex items-center gap-2"><Wifi size={16} className="text-cyan-300" /> Monitoring real-time</span>
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
                <div className="flex items-center justify-between text-emerald-200"><span className="text-xs text-slate-400">STATUS PINTU</span><DoorClosed size={19} /></div>
                <p className="mt-5 text-xl font-bold tracking-wide sm:text-2xl">TERTUTUP</p>
                <p className="mt-1 text-xs text-slate-500">Tampilan mengikuti telemetry</p>
              </div>
              <div className="rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-400/10 to-slate-950/30 p-4 sm:p-5">
                <div className="flex items-center justify-between text-violet-200"><span className="text-xs text-slate-400">AKSES TERAKHIR</span><Fingerprint size={19} /></div>
                <p className="mt-5 truncate text-lg font-semibold sm:text-xl">RFID member</p>
                <p className="mt-1 text-xs text-slate-500">Pencatatan akses masuk</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-gradient-to-r from-cyan-400/[0.08] via-slate-950/30 to-slate-950/30 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">MONITORING ESP32</p>
                  <p className="mt-1 text-sm font-semibold">Sensor, resource, dan koneksi</p>
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
              <span className="inline-flex items-center gap-1 text-cyan-200">Lihat panel <ArrowRight size={13} /></span>
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">SEMUA DALAM SATU PANEL</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Kontrol yang jelas, pantauan yang lengkap.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-500">Dirancang untuk membantu anggota tim memantau akses dan kondisi perangkat secara langsung.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description, accent }) => (
              <article key={title} className="group rounded-2xl border border-slate-800/90 bg-slate-900/45 p-5 transition hover:-translate-y-1 hover:border-slate-600 hover:bg-slate-900/75 sm:p-6">
                <div className={`mb-5 grid h-11 w-11 place-items-center rounded-xl ${accent === "cyan" ? "bg-cyan-300/10 text-cyan-200" : accent === "violet" ? "bg-violet-300/10 text-violet-200" : "bg-emerald-300/10 text-emerald-200"}`}>
                  <Icon size={21} />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition group-hover:text-cyan-200">Bagian dari panel <ArrowRight size={13} /></span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="cara-kerja" className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">ALUR SISTEM</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Dari perangkat ke dashboard, secara langsung.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">ESP32 mengirim pembacaan sensor ke broker MQTT. Dashboard menerima telemetry, menampilkan status, dan mengirim kontrol gerbang ke perangkat yang dipilih.</p>
            <Link href="/signup" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition hover:text-cyan-200">Mulai gunakan panel <ArrowRight size={16} /></Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["01", "ESP32", "Sensor dan aktuator"],
              ["02", "MQTT", "Pesan dua arah"],
              ["03", "Dashboard", "Pantau dan kendalikan"],
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
