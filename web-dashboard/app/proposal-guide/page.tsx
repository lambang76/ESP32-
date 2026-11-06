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

const templateRequirements = [
  ["MCU hardware", "Use ESP32 with at least one sensor, one actuator, and an OLED/TFT/LCD display. The garage project can keep RC522 + reed switch + servo; add a display if the lecturer confirms this minimum applies."],
  ["Two-router topology", "Show Router R1, Router R2, and three routed networks: 192.168.10.0/24, 10.10.10.0/31, and the application-side network specified by the lecturer. Use static routes and no NAT between the lab networks."],
  ["Local socket server", "The template calls for a free local TCP socket and/or WebSocket server using JSON messages. Select one server placement (Network A or application Network C) and show ESP32 and controller clients connecting to it."],
  ["Static addressing and lab operation", "Give the ESP32, server, and controller static IPs. The required demo can run on the lab LAN without internet. Do not make DDNS or a public cloud broker a dependency for this required path."],
  ["CDIO evidence", "Keep the requirements, network/IP plan, wiring, socket message formats, workflow, implementation plan, test cases, budget, schedule, roles, success indicators, assessment, risks, and project outputs."],
];

const draftGaps = [
  ["Already fits the garage topic", "RFID UID validation, reed-switch door feedback, servo movement, local access, hardware safety notes, and measurable test cases are already present in the project draft."],
  ["Needs alignment with the lecturer template", "The current draft uses one router, direct HTTP to the ESP32, Destination NAT/DDNS over the public internet, and no socket server. It also does not list an OLED/TFT/LCD. These differ from the required two-router, static-routed, local socket-server design."],
  ["Keep as an optional comparison/demo", "The existing Next.js + EMQX Cloud dashboard can be described as an optional cloud extension or a separate demo. Do not draw it as the required local socket-server path unless the group actually implements a server adapter and tests it."],
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
              <a href="#topology" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200">View network topology <ArrowRight size={16} /></a>
              <a href="#risks" className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-950/30 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-300/40"><ShieldAlert size={16} /> Failure and mitigation plan</a>
            </div>
          </div>
        </section>

        <section id="topology" className="mt-10 scroll-mt-6 rounded-3xl border border-cyan-300/20 bg-slate-900/70 p-4 sm:p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Main design focus · two routers</p><h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Smart Garage network topology</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">The ESP32 and user devices sit on separate networks. R1 routes across the point-to-point link to R2; the local socket server relays telemetry and commands between the ESP32 and controller.</p></div>
            <span className="w-fit rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">Local lab path · no internet required</span>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-[#f7fafc] p-2 sm:p-4">
            <p className="px-2 pb-2 text-[11px] font-medium text-slate-500 sm:hidden">Swipe horizontally to view the complete topology →</p>
            <svg viewBox="0 0 1000 510" role="img" aria-labelledby="garage-topology-title garage-topology-desc" className="mx-auto block min-w-[850px] w-full max-w-[1180px] text-slate-800">
              <title id="garage-topology-title">Smart Garage two-router network topology</title>
              <desc id="garage-topology-desc">ESP32 on Network A connects through Router R1 and a point-to-point link to Router R2. A socket server and the user dashboard are on the application network. Telemetry travels toward the server and control commands return to the ESP32.</desc>
              <defs>
                <marker id="topology-data-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#0891b2" /></marker>
                <marker id="topology-command-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#7c3aed" /></marker>
                <marker id="topology-link-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#64748b" /></marker>
              </defs>

              <rect x="20" y="178" width="365" height="205" rx="18" fill="#fff9e8" stroke="#fbbf24" strokeWidth="2" strokeDasharray="8 6" />
              <text x="40" y="205" fontSize="14" fontWeight="800" fill="#92400e">NETWORK A · DEVICE SIDE</text>
              <text x="40" y="225" fontSize="12" fill="#78716c">192.168.10.0/24 · static addresses</text>

              <rect x="595" y="178" width="385" height="205" rx="18" fill="#ecfdf5" stroke="#2dd4bf" strokeWidth="2" strokeDasharray="8 6" />
              <text x="615" y="205" fontSize="14" fontWeight="800" fill="#115e59">NETWORK C · SERVER / USER SIDE</text>
              <text x="615" y="225" fontSize="12" fill="#64748b">172.168.10.0/24 · static addresses*</text>

              <text x="500" y="202" textAnchor="middle" fontSize="12" fontWeight="800" fill="#475569">NETWORK B</text>
              <text x="500" y="220" textAnchor="middle" fontSize="11" fill="#64748b">10.10.10.0/31</text>

              <path d="M112 144 V128 H870 V210" fill="none" stroke="#0891b2" strokeWidth="3" strokeDasharray="9 7" markerEnd="url(#topology-data-arrow)" />
              <text x="490" y="116" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0e7490">TELEMETRY · ESP32 → R1 → R2 → SOCKET SERVER → DASHBOARD</text>
              <path d="M870 396 V438 H112 V364" fill="none" stroke="#7c3aed" strokeWidth="3" strokeDasharray="9 7" markerEnd="url(#topology-command-arrow)" />
              <text x="490" y="462" textAnchor="middle" fontSize="13" fontWeight="800" fill="#6d28d9">CONTROL · DASHBOARD → SOCKET SERVER → R2 → R1 → ESP32</text>

              <rect x="40" y="250" width="145" height="114" rx="13" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="112" y="277" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a">ESP32 GARAGE</text>
              <text x="112" y="299" textAnchor="middle" fontSize="12" fill="#475569">192.168.10.10</text>
              <text x="112" y="319" textAnchor="middle" fontSize="11" fill="#64748b">RFID · reed switch</text>
              <text x="112" y="338" textAnchor="middle" fontSize="11" fill="#64748b">servo · Wi-Fi client</text>

              <rect x="225" y="250" width="140" height="114" rx="13" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="295" y="278" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a">ROUTER R1</text>
              <text x="295" y="300" textAnchor="middle" fontSize="12" fill="#475569">LAN .10.1/24</text>
              <text x="295" y="320" textAnchor="middle" fontSize="11" fill="#64748b">P2P .0/31</text>
              <text x="295" y="340" textAnchor="middle" fontSize="11" fill="#64748b">static route to C</text>

              <rect x="595" y="250" width="140" height="114" rx="13" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="665" y="278" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a">ROUTER R2</text>
              <text x="665" y="300" textAnchor="middle" fontSize="12" fill="#475569">LAN .10.1/24*</text>
              <text x="665" y="320" textAnchor="middle" fontSize="11" fill="#64748b">P2P .1/31</text>
              <text x="665" y="340" textAnchor="middle" fontSize="11" fill="#64748b">static route to A</text>

              <rect x="775" y="238" width="180" height="66" rx="12" fill="#ecfeff" stroke="#67e8f9" strokeWidth="1.5" />
              <text x="865" y="262" textAnchor="middle" fontSize="14" fontWeight="800" fill="#155e75">LOCAL SOCKET SERVER</text>
              <text x="865" y="283" textAnchor="middle" fontSize="11" fill="#475569">172.168.10.20 · TCP/JSON</text>

              <rect x="775" y="319" width="180" height="48" rx="12" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="865" y="340" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a">WEB CONTROLLER</text>
              <text x="865" y="357" textAnchor="middle" fontSize="11" fill="#64748b">172.168.10.30 · WebSocket</text>

              <path d="M185 300 H220" stroke="#64748b" strokeWidth="2" markerEnd="url(#topology-link-arrow)" />
              <text x="202" y="289" textAnchor="middle" fontSize="9" fill="#64748b">Wi-Fi</text>
              <path d="M365 300 H590" stroke="#64748b" strokeWidth="2" markerEnd="url(#topology-link-arrow)" />
              <path d="M590 313 H365" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#topology-link-arrow)" />
              <text x="477" y="286" textAnchor="middle" fontSize="10" fill="#475569">point-to-point Ethernet</text>
              <path d="M735 278 H770" stroke="#64748b" strokeWidth="2" markerEnd="url(#topology-link-arrow)" />
              <path d="M865 305 V315" stroke="#64748b" strokeWidth="2" markerEnd="url(#topology-link-arrow)" />

              <circle className="topology-packet" r="6" fill="#06b6d4"><animateMotion dur="5s" repeatCount="indefinite" path="M112 144 V128 H870 V210" /></circle>
              <circle className="topology-packet" r="6" fill="#8b5cf6"><animateMotion dur="5s" repeatCount="indefinite" path="M870 396 V438 H112 V364" /></circle>
            </svg>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-4"><b className="text-sm text-amber-100">Network A · MCU LAN</b><p className="mt-1 text-xs leading-5 text-slate-400">R1: 192.168.10.1/24 · ESP32: 192.168.10.10/24 · gateway 192.168.10.1</p></div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4"><b className="text-sm text-slate-100">Network B · router link</b><p className="mt-1 text-xs leading-5 text-slate-400">R1: 10.10.10.0/31 · R2: 10.10.10.1/31 · static routes both ways</p></div>
            <div className="rounded-xl border border-teal-300/15 bg-teal-300/[0.05] p-4"><b className="text-sm text-teal-100">Network C · application LAN</b><p className="mt-1 text-xs leading-5 text-slate-400">R2: 172.168.10.1/24 · server: .20 · controller: .30</p></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400"><span className="inline-flex items-center gap-2"><span className="h-1 w-7 rounded bg-cyan-500" />Telemetry to controller</span><span className="inline-flex items-center gap-2"><span className="h-1 w-7 rounded bg-violet-500" />Commands back to ESP32</span><span>Internal routing only · no NAT · no cloud required</span></div>
          <p className="mt-3 text-xs leading-5 text-amber-200/80">*The lecturer’s template uses 172.168.10.0/24, which is not an RFC 1918 private range. Use it only on an isolated lab network if that exact block is required; request approval before substituting a private subnet.</p>
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

        <section id="lecturer-template" className="mt-10 scroll-mt-6 rounded-3xl border border-cyan-300/15 bg-slate-900/60 p-5 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Using the two provided documents</p>
          <h2 className="mt-2 text-2xl font-semibold">Follow the lecturer’s RPP-CDIO template; replace its greenhouse example with Smart Garage</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">The template’s greenhouse paragraphs and example sensor values are sample content. Keep its required project structure and network constraints, then use the Smart Garage proposal for the topic, RFID access, door sensing, and servo details.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {templateRequirements.map(([title, description]) => <article key={title} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><h3 className="text-sm font-semibold text-cyan-100">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p></article>)}
          </div>
          <h3 className="mt-7 text-lg font-semibold">What to change in the current Smart Garage draft</h3>
          <div className="mt-3 space-y-3">{draftGaps.map(([title, description]) => <article key={title} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><h4 className="text-sm font-semibold text-violet-100">{title}</h4><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p></article>)}</div>
          <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-50/80"><b className="text-amber-100">Check the IP plan with the lecturer:</b> the template’s 172.168.10.0/24 block is outside the RFC 1918 private ranges. Keep it only on an isolated lab network if the lecturer requires that exact block; otherwise request approval to replace it with a private subnet. The 10.10.10.0/31 link is a point-to-point link and may need /30 if the selected router setup does not support /31.</div>
          <p className="mt-4 text-sm leading-6 text-slate-400">Before submission, redraw the topology and update the IP table, router routes, socket protocol table, BOM, schedule, and tests together. The template’s sample MikroTik commands and greenhouse code are examples, not ready-to-run project configuration.</p>
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
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5"><h3 className="font-semibold text-cyan-100">Proposal draft</h3><p className="mt-2 text-sm leading-6 text-slate-400">The supplied Smart Garage draft describes RFID RC522 access, a reed switch for real door position, a servo actuator, an ESP32 web page, and one-router DDNS access. Treat components and tests as planned until physically assembled and verified.</p></div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5"><h3 className="font-semibold text-violet-100">Current repository demo</h3><p className="mt-2 text-sm leading-6 text-slate-400">The Next.js dashboard and MQTT dummy simulator demonstrate a cloud messaging path. They do not by themselves satisfy the template’s two-router local socket-server requirement. Keep the two architectures clearly separated unless the team implements and tests an adapter.</p></div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">Do not include DHT temperature/humidity as a required proposal feature if the group has removed that sensor from the agreed design.</p>
        </section>

        <div className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center sm:p-6"><div><h2 className="font-semibold">Ready to review the system setup?</h2><p className="mt-1 text-sm text-slate-400">Open the installation guide and project simulation.</p></div><div className="flex flex-wrap gap-3"><Link href="/panduan" className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-300/40">Project setup guide</Link><Link href="/simulasi" className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200">Open simulation</Link></div></div>
      </div>
    </main>
  );
}
