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
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Network architecture: cloud + local backup</p>
              <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Smart Garage network topology</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">This topology has two distinct routes: normal cloud access through Vercel and EMQX, plus a local monitoring route through the laptop server when cloud services are unavailable.</p>
            </div>
            <span className="w-fit rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">Cloud route + local fallback</span>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-[#f7fafc] p-2 sm:p-4">
            <p className="px-2 pb-2 text-[11px] font-medium text-slate-500 sm:hidden">Swipe horizontally to view the complete topology &gt;&gt;</p>
            <svg viewBox="0 0 1200 700" role="img" aria-labelledby="garage-topology-title garage-topology-desc" className="mx-auto block min-w-[960px] w-full max-w-[1220px] text-slate-800">
              <title id="garage-topology-title">Smart Garage cloud and two-router local backup topology</title>
              <desc id="garage-topology-desc">Vercel and EMQX are cloud services. Router A connects the ESP32, RFID reader, servo, and a laptop local WebSocket server/database. Router A and Router B are joined by a local routed link. A phone or laptop client on Router B can access the local server if cloud services are down.</desc>
              <defs>
                <marker id="topo-cloud-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#64748b" /></marker>
                <marker id="topo-local-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#0891b2" /></marker>
                <marker id="topo-device-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#64748b" /></marker>
              </defs>

              <rect x="22" y="18" width="1156" height="178" rx="20" fill="#eff8ff" stroke="#7dd3fc" strokeWidth="2" strokeDasharray="8 6" />
              <text x="48" y="47" fontSize="13" fontWeight="800" letterSpacing="1.5" fill="#0369a1">INTERNET / CLOUD SERVICES</text>
              <rect x="95" y="78" width="220" height="78" rx="13" fill="white" stroke="#93c5fd" strokeWidth="1.5" />
              <text x="205" y="108" textAnchor="middle" fontSize="15" fontWeight="800" fill="#1e3a8a">VERCEL DEPLOY</text>
              <text x="205" y="132" textAnchor="middle" fontSize="12" fill="#64748b">Hosts the web dashboard</text>
              <path d="M315 117 H435" fill="none" stroke="#64748b" strokeWidth="2" markerEnd="url(#topo-cloud-arrow)" />
              <path d="M435 132 H315" fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#topo-device-arrow)" />
              <rect x="445" y="72" width="300" height="90" rx="42" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="595" y="108" textAnchor="middle" fontSize="17" fontWeight="800" fill="#334155">INTERNET / WAN</text>
              <text x="595" y="132" textAnchor="middle" fontSize="12" fill="#64748b">Public network access</text>
              <path d="M745 117 H865" fill="none" stroke="#64748b" strokeWidth="2" markerEnd="url(#topo-cloud-arrow)" />
              <path d="M865 132 H745" fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#topo-device-arrow)" />
              <rect x="875" y="78" width="220" height="78" rx="13" fill="white" stroke="#93c5fd" strokeWidth="1.5" />
              <text x="985" y="108" textAnchor="middle" fontSize="15" fontWeight="800" fill="#1e3a8a">EMQX CLOUD</text>
              <text x="985" y="132" textAnchor="middle" fontSize="12" fill="#64748b">MQTT broker | TLS / WSS</text>

              <rect x="22" y="225" width="465" height="430" rx="20" fill="#fff9e8" stroke="#fbbf24" strokeWidth="2" strokeDasharray="8 6" />
              <text x="48" y="258" fontSize="13" fontWeight="800" letterSpacing="1.5" fill="#92400e">GARAGE LAN - ROUTER A</text>
              <text x="48" y="280" fontSize="12" fill="#78716c">Network A | 192.168.10.0/24</text>
              <rect x="713" y="225" width="465" height="430" rx="20" fill="#ecfdf5" stroke="#2dd4bf" strokeWidth="2" strokeDasharray="8 6" />
              <text x="739" y="258" fontSize="13" fontWeight="800" letterSpacing="1.5" fill="#115e59">USER LAN - ROUTER B</text>
              <text x="739" y="280" fontSize="12" fill="#64748b">Network C | 172.168.10.0/24*</text>

              <path d="M595 162 V205 H430 V344 H285 V354" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 5" markerEnd="url(#topo-cloud-arrow)" />
              <path d="M595 162 V205 H1100 V330 H785 V354" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 5" markerEnd="url(#topo-cloud-arrow)" />
              <text x="297" y="330" fontSize="11" fontWeight="700" fill="#64748b">WAN</text>
              <text x="1090" y="320" fontSize="11" fontWeight="700" fill="#64748b">WAN</text>

              <rect x="48" y="354" width="130" height="94" rx="13" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="113" y="383" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a">ESP32</text>
              <text x="113" y="404" textAnchor="middle" fontSize="12" fill="#475569">192.168.10.10</text>
              <text x="113" y="426" textAnchor="middle" fontSize="11" fill="#64748b">Wi-Fi device</text>
              <rect x="48" y="300" width="130" height="42" rx="10" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="113" y="326" textAnchor="middle" fontSize="13" fontWeight="700" fill="#334155">RFID RC522</text>
              <path d="M113 342 V351" stroke="#64748b" strokeWidth="1.8" markerEnd="url(#topo-device-arrow)" />
              <rect x="48" y="462" width="130" height="42" rx="10" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="113" y="488" textAnchor="middle" fontSize="13" fontWeight="700" fill="#334155">SERVO GATE</text>
              <path d="M113 449 V459" stroke="#64748b" strokeWidth="1.8" markerEnd="url(#topo-device-arrow)" />

              <rect x="220" y="354" width="130" height="94" rx="13" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="285" y="383" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a">ROUTER A</text>
              <text x="285" y="404" textAnchor="middle" fontSize="11" fill="#475569">192.168.10.1/24</text>
              <text x="285" y="426" textAnchor="middle" fontSize="11" fill="#64748b">Wi-Fi | routing</text>
              <rect x="365" y="354" width="105" height="132" rx="13" fill="white" stroke="#67e8f9" strokeWidth="2" />
              <text x="417" y="382" textAnchor="middle" fontSize="13" fontWeight="800" fill="#155e75">LAPTOP</text>
              <text x="417" y="403" textAnchor="middle" fontSize="11" fill="#475569">Local server</text>
              <text x="417" y="422" textAnchor="middle" fontSize="10" fill="#64748b">WebSocket</text>
              <text x="417" y="440" textAnchor="middle" fontSize="10" fill="#64748b">Database</text>
              <text x="417" y="463" textAnchor="middle" fontSize="10" fill="#475569">192.168.10.20</text>

              <rect x="720" y="354" width="130" height="94" rx="13" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="785" y="383" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a">ROUTER B</text>
              <text x="785" y="404" textAnchor="middle" fontSize="10" fill="#475569">172.168.10.1/24*</text>
              <text x="785" y="426" textAnchor="middle" fontSize="11" fill="#64748b">Wi-Fi | routing</text>
              <rect x="947" y="354" width="190" height="94" rx="13" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="1042" y="383" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f172a">MONITORING CLIENT</text>
              <text x="1042" y="405" textAnchor="middle" fontSize="12" fill="#475569">Phone / laptop</text>
              <text x="1042" y="427" textAnchor="middle" fontSize="11" fill="#64748b">172.168.10.30</text>

              <path d="M178 390 H215" fill="none" stroke="#64748b" strokeWidth="2" markerEnd="url(#topo-device-arrow)" />
              <path d="M215 402 H178" fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#topo-device-arrow)" />
              <text x="197" y="380" textAnchor="middle" fontSize="10" fill="#64748b">Wi-Fi</text>
              <path d="M350 390 H360" fill="none" stroke="#64748b" strokeWidth="2" markerEnd="url(#topo-device-arrow)" />
              <path d="M360 402 H350" fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#topo-device-arrow)" />
              <text x="355" y="378" textAnchor="middle" fontSize="9" fill="#64748b">LAN</text>
              <path d="M285 450 V525 H785 V450" fill="none" stroke="#0891b2" strokeWidth="3" strokeDasharray="8 6" markerStart="url(#topo-local-arrow)" markerEnd="url(#topo-local-arrow)" />
              <rect x="465" y="505" width="225" height="42" rx="10" fill="#f7fafc" stroke="#cbd5e1" />
              <text x="577" y="522" textAnchor="middle" fontSize="11" fontWeight="800" fill="#475569">LOCAL ROUTED LINK</text>
              <text x="577" y="538" textAnchor="middle" fontSize="10" fill="#64748b">Network B | 10.10.10.0/31</text>
              <path d="M850 390 H942" fill="none" stroke="#64748b" strokeWidth="2" markerEnd="url(#topo-device-arrow)" />
              <path d="M942 402 H850" fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#topo-device-arrow)" />
              <text x="896" y="379" textAnchor="middle" fontSize="10" fill="#64748b">Wi-Fi / LAN</text>
              <text x="640" y="584" textAnchor="middle" fontSize="12" fontWeight="800" fill="#0e7490">LOCAL BACKUP: CLIENT -&gt; ROUTER B -&gt; ROUTER A -&gt; LAPTOP SERVER</text>
              <text x="640" y="606" textAnchor="middle" fontSize="11" fill="#64748b">Data remains reachable over the routed LAN link if cloud services are down and the local devices have power.</text>
              <circle className="topology-packet" r="6" fill="#06b6d4"><animateMotion dur="4s" repeatCount="indefinite" path="M285 450 V525 H785 V450" /></circle>
              <circle className="topology-packet" r="6" fill="#8b5cf6"><animateMotion dur="4s" repeatCount="indefinite" path="M785 450 V540 H285 V450" /></circle>
            </svg>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4"><b className="text-sm text-cyan-100">Cloud route | normal operation</b><p className="mt-1 text-xs leading-5 text-slate-400">ESP32 -&gt; Router A -&gt; Internet -&gt; EMQX MQTT. Browser -&gt; Router B -&gt; Internet -&gt; Vercel website and EMQX over WSS.</p></div>
            <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-4"><b className="text-sm text-amber-100">Local route | cloud fallback</b><p className="mt-1 text-xs leading-5 text-slate-400">ESP32 -&gt; Router A -&gt; laptop WebSocket server/database; Router B client reaches the laptop through the routed inter-router link.</p></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400"><span className="inline-flex items-center gap-2"><span className="h-1 w-7 rounded bg-slate-500" />Internet / hosted services</span><span className="inline-flex items-center gap-2"><span className="h-1 w-7 rounded bg-cyan-500" />Local routed backup path</span><span>Router-to-router traffic uses static routing, no NAT</span></div>
          <p className="mt-3 text-xs leading-5 text-amber-200/80">*The lecturer template uses 172.168.10.0/24 for the user LAN. This is outside the RFC 1918 private ranges; keep it only on an isolated lab network if required, or ask the lecturer to approve a private-range replacement.</p>
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
