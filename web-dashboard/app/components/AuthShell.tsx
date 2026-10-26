import type { ReactNode } from "react";
import { DoorOpen, type LucideIcon } from "lucide-react";

export default function AuthShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#07111e] px-4 py-8 text-slate-100 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(8,145,178,0.18),transparent_38%),radial-gradient(ellipse_at_bottom_right,rgba(109,40,217,0.13),transparent_42%)]" />
      <section className="relative m-auto w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/65 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <DoorOpen size={24} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300 sm:text-xs">
              JTD · GARAGE IOT
            </p>
            <h1 className="mt-1 text-lg font-semibold">Smart Garage</h1>
          </div>
        </div>

        <div className="mb-7">
          <div className="mb-4 inline-flex rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-cyan-200">
            <Icon size={21} />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        </div>

        {children}
      </section>
    </main>
  );
}
