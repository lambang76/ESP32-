import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  ShieldAlert,
} from "lucide-react";

const chapters = [
  {
    title: "Cover and project identity",
    points: [
      "Use the format required by your department. Include the project title, course, program, group members, lecturer, and submission date.",
      "Suggested title: Smart Garage: RFID Access Control and Remote Door Monitoring Based on ESP32 with MikroTik Network Integration.",
    ],
  },
  {
    title: "Chapter 1 — Introduction",
    points: [
      "Explain the problem: manual gate access gives limited access control and makes it difficult to check the actual door position remotely.",
      "Write a focused problem statement, objectives, benefits, scope, limitations, and document structure.",
      "State whether the work is a proposal, a simulator demo, or a tested physical prototype. Do not describe planned hardware as already working.",
    ],
  },
  {
    title: "Chapter 2 — Related work",
    points: [
      "Explain the relevant technologies: ESP32, RFID RC522, reed switch, servo, local web server, MikroTik routing, DDNS, and VPN.",
      "Compare a few credible, recent projects or papers. Cite each borrowed fact, diagram, and specification, then explain what your project adds.",
    ],
  },
  {
    title: "Chapter 3 — Design and method",
    points: [
      "Show a block diagram, wiring diagram, pin map, access flowchart, and network topology. Label local access separately from remote access.",
      "Describe the intended RFID flow: read UID → check the authorized list → move the servo → read the reed switch to confirm the actual door position.",
      "Describe the network path used in the proposal: ESP32 local web server → Router A / MikroTik → secure remote path such as WireGuard VPN → authorized phone or laptop.",
      "List the hardware, software, configuration steps, and measurable test procedure. Treat MQTT/cloud functions as a separate optional path only if they are part of the agreed scope.",
    ],
  },
  {
    title: "Schedule, budget, and references",
    points: [
      "Make a week-by-week work plan and a component budget with source links and the date each price was checked. Mark estimates clearly.",
      "Use the citation style required by your lecturer. Prefer manufacturer documentation, official network documentation, standards, and research papers.",
      "Attach the topology, schematic, test cases, and screenshots as appendices. Add captions and cite any diagram adapted from another source.",
    ],
  },
];

const risks = [
  ["Power failure", "The ESP32 and router stop when their supplies run out.", "Use a correctly sized DC UPS for the ESP32 and Router A. State its expected runtime only after measuring it. If backup power is exhausted, use the agreed manual access procedure; monitoring is unavailable."],
  ["Internet or remote link failure", "Users outside the garage cannot reach the private ESP32 page.", "Keep RFID access and local monitoring on the garage LAN. A VPN across the two MikroTik routers can provide a private remote route when both routers and the WAN/VPN endpoint are reachable. DDNS only provides a name; it does not provide a VPN or encryption."],
  ["Website or MQTT cloud outage", "A hosted dashboard or cloud broker may be unavailable.", "For the proposal architecture, the ESP32-hosted local web page is the monitoring fallback on the same LAN. Cross-router access still needs the configured private route. A second router alone does not replace a server or broker."],
  ["ESP32, sensor, or actuator failure", "Local readings or gate actuation may stop or become unreliable.", "Test components individually, report faults clearly, keep a spare controller/sensor where practical, and provide a manual gate procedure. Never report a commanded servo movement as confirmed door position; use the reed switch for confirmation."],
  ["Unauthorized remote access", "An exposed device page or open router rule could allow unwanted control.", "Prefer WireGuard and firewall allowlists. Do not expose the ESP32 plain HTTP server directly to the public internet. If a class demo requires port forwarding, document the risk and restrict access."],
];

export default function ProposalGuidePage() {
  return (
    <main className="min-h-screen bg-[#07111e] text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/40">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16} /> Home</Link>
          <span className="text-sm font-semibold text-cyan-100">Smart Garage · Proposal Guide</span>
          <Link href="/panduan" className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-cyan-100 sm:text-sm">Project setup</Link>
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[0.10] via-slate-900/80 to-violet-400/[0.08] p-6 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300"><BookOpen size={15} /> Group project resource</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">How to prepare the Smart Garage proposal</h1>
            <p className="mt-5 text-sm leading-7 text-slate-300 sm:text-base">Use this guide to organize the proposal around the project brief. Follow your lecturer’s required format, verify technical details, and label simulator results, planned features, and tested hardware accurately.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#outline" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200">View proposal outline <ArrowRight size={16} /></a>
              <a href="#risks" className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-950/30 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-300/40"><ShieldAlert size={16} /> Failure and mitigation plan</a>
            </div>
          </div>
        </section>

        <section id="outline" className="mt-10 scroll-mt-6">
          <div className="mb-5 flex items-end gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><ClipboardList size={20} /></span><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Suggested structure</p><h2 className="mt-1 text-2xl font-semibold">Proposal outline</h2></div></div>
          <div className="grid gap-4 md:grid-cols-2">
            {chapters.map((chapter, index) => (
              <article key={chapter.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-sm font-bold text-cyan-200">{index + 1}</span><h3 className="font-semibold">{chapter.title}</h3></div>
                <ul className="space-y-3 text-sm leading-6 text-slate-400">{chapter.points.map((point) => <li key={point} className="flex gap-2"><CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-300" /><span>{point}</span></li>)}</ul>
              </article>
            ))}
            <article className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.04] p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full border border-violet-300/20 bg-violet-300/10 text-violet-200"><FileText size={17} /></span><h3 className="font-semibold">Conclusion and appendix</h3></div>
              <ul className="space-y-3 text-sm leading-6 text-slate-400">
                <li>Summarize the planned system and how the test plan will evaluate it. Do not write expected results as measured results.</li>
                <li>Include the wiring, router topology, pin mapping, proposed schedule, budget sources, and blank test-result tables as appendices.</li>
                <li>Have all group members check the scope, names, citations, and consistency with the lecturer’s instructions before submission.</li>
              </ul>
            </article>
          </div>
        </section>

        <section id="risks" className="mt-10 scroll-mt-6 rounded-3xl border border-amber-300/15 bg-slate-900/60 p-5 sm:p-8">
          <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300/10 text-amber-200"><ShieldAlert size={20} /></span><div><p className="text-xs font-bold uppercase tracking-widest text-amber-200">Availability and safety</p><h2 className="mt-1 text-2xl font-semibold">Risks and mitigations to discuss</h2></div></div>
          <div className="space-y-3">{risks.map(([risk, impact, mitigation]) => <article key={risk} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-4 md:grid-cols-[190px_1fr_1.3fr]"><h3 className="text-sm font-semibold text-amber-100">{risk}</h3><p className="text-sm leading-6 text-slate-400">{impact}</p><p className="text-sm leading-6 text-slate-300">{mitigation}</p></article>)}</div>
          <p className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4 text-sm leading-6 text-cyan-50/80">For this proposal, the local ESP32 page is the cloud-independent fallback. A user on the garage Wi-Fi can reach it while the board and router are powered. A user on Router B needs the routers’ private VPN/routing path; this must be configured and tested. If power is unavailable and the UPS is depleted, live monitoring cannot continue.</p>
        </section>

        <section className="mt-10 rounded-3xl border border-rose-300/15 bg-rose-300/[0.04] p-5 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-rose-200">Project accuracy check</p>
          <h2 className="mt-2 text-2xl font-semibold">Separate the proposal from what the repository currently demonstrates</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5"><h3 className="font-semibold text-cyan-100">Proposal design</h3><p className="mt-2 text-sm leading-6 text-slate-400">The revised proposal describes RFID RC522 access, a reed switch for real door position, a servo actuator, an ESP32-hosted local page, and MikroTik remote networking. Call these proposed components until each has been assembled and tested.</p></div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5"><h3 className="font-semibold text-violet-100">Current repository demo</h3><p className="mt-2 text-sm leading-6 text-slate-400">The web dashboard and MQTT dummy simulator can demonstrate the cloud messaging flow. The current Arduino firmware/local page may not yet implement the proposal’s RFID, reed switch, servo, and router VPN design. Verify the checked-in sketch before describing any hardware as implemented.</p></div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">Do not include DHT temperature/humidity as a required proposal feature if the group has removed that sensor from the agreed design.</p>
        </section>

        <div className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center sm:p-6"><div><h2 className="font-semibold">Ready to review the system setup?</h2><p className="mt-1 text-sm text-slate-400">Open the installation guide and project simulation.</p></div><div className="flex flex-wrap gap-3"><Link href="/panduan" className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-300/40">Project setup guide</Link><Link href="/simulasi" className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200">Open simulation</Link></div></div>
      </div>
    </main>
  );
}
