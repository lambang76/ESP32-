import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Cloud, Code2, DoorOpen, Radio, Server, ShieldCheck, Terminal } from "lucide-react";

const sections = [
  {
    id: "setup",
    title: "1. Prerequisites",
    icon: CheckCircle2,
    body: <>Install Node.js LTS and prepare Supabase, EMQX Cloud, and VS Code for the ESP32 project. To try the dashboard now, run the dummy simulator from the <code>web-dashboard</code> folder.</>,
  },
  {
    id: "supabase",
    title: "2. Supabase, device table, and accounts",
    icon: ShieldCheck,
    body: <ol className="list-decimal space-y-2 pl-5">
      <li>Copy the Project URL and anon/publishable key from Project Settings → API Keys.</li>
      <li>Make sure <code>public.devices</code> contains <code>id, device_name, device_type, topic_sub, topic_pub</code>. Configure RLS using <code>web-dashboard/supabase/auth_policy.sql</code>.</li>
      <li>To enable the discussion forum, run <code>web-dashboard/supabase/forum.sql</code> in the SQL Editor. Re-run this script to enable edit and delete policies. The forum is available to signed-in users only.</li>
      <li>For the simulator, add a device named ESP32 Dummy with topic_sub <code>jtd/esp32/garasi/#</code> and topic_pub <code>jtd/esp32/garasi/relay</code>.</li>
      <li>To enable username sign-in, run <code>web-dashboard/supabase/username_login.sql</code> in the SQL Editor. Store <code>SUPABASE_SERVICE_ROLE_KEY</code> as a server-only environment variable. Never use the <code>NEXT_PUBLIC</code> prefix for this key.</li>
      <li>Under Authentication → URL Configuration, add <code>http://localhost:3000/**</code> and your Vercel domain, such as <code>https://projectesp32.vercel.app/**</code>, to Redirect URLs.</li>
      <li>Enable the Email provider. Sign up on the website and confirm your email if prompted. Usernames must be unique and contain 3–24 letters, numbers, or underscores.</li>
    </ol>,
  },
  {
    id: "emqx",
    title: "3. EMQX and environment variables",
    icon: Server,
    body: <>
      <p>In EMQX Cloud, create an MQTT user under Access Control → Authentication. Find the host in MQTT Connection Information. Use TLS port 8883 for the ESP32 and WebSocket TLS port 8084 for browsers. Enter the host without a protocol or port.</p>
      <p>Set the values in <code>web-dashboard/.env.local</code> (do not commit this file):</p>
      <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-black/40 p-4 text-xs leading-6 text-cyan-100">{`NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
NEXT_PUBLIC_EMQX_HOST=your-deployment.emqxsl.com
NEXT_PUBLIC_EMQX_USERNAME=dashboard_user
NEXT_PUBLIC_EMQX_PASSWORD=your_mqtt_password`}</pre>
      <p>Use the Supabase anon/publishable key, not service_role or sb_secret. MQTT connects directly from the browser, so NEXT_PUBLIC credentials are visible to visitors. Create an EMQX user with ACL permissions limited to this project’s topics.</p>
    </>,
  },
  {
    id: "local",
    title: "4. Run the website and simulator",
    icon: Terminal,
    body: <>
      <p>In the first terminal:</p>
      <pre className="rounded-xl border border-slate-800 bg-black/40 p-4 text-xs leading-6 text-cyan-100">cd web-dashboard{"\n"}npm install{"\n"}npm run dev</pre>
      <p>If needed, copy <code>.env.example</code> to <code>.env.local</code> without overwriting a file that already has values. Open <code>http://localhost:3000</code>. In a second terminal, run:</p>
      <pre className="rounded-xl border border-slate-800 bg-black/40 p-4 text-xs leading-6 text-cyan-100">cd web-dashboard{"\n"}npm run simulate:esp32</pre>
      <p>Keep both processes running. The simulator stops when its process is closed or the laptop goes offline.</p>
    </>,
  },
  {
    id: "use",
    title: "5. Using the dashboard",
    icon: DoorOpen,
    body: <>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Create an account, confirm your email if prompted, then sign in.</li>
        <li>Choose a device from the dropdown. The status badge shows its MQTT broker connection.</li>
        <li>Monitor the door, RFID, and ESP32 health cards. Values appear after messages are received.</li>
        <li>Select OPEN GARAGE or CLOSE GARAGE to send a command. The terminal displays MQTT messages.</li>
        <li>Use the Sign out button to leave. The password recovery link is on the sign-in page.</li>
      </ol>
      <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-amber-100">A sent command does not confirm that the physical gate moved. The device must publish a status update for confirmation.</p>
    </>,
  },
  {
    id: "esp32",
    title: "6. Set up a physical ESP32",
    icon: Code2,
    body: <>
      <ol className="list-decimal space-y-2 pl-5">
        <li>In Arduino IDE, install the ESP32 board package by Espressif Systems through Boards Manager. Install PubSubClient through Library Manager.</li>
        <li>Open <code>firmware/arduino/SmartGarageESP32/SmartGarageESP32.ino</code>.</li>
        <li>Copy <code>secrets.example.h</code> to <code>secrets.h</code> in the same sketch folder, then enter your Wi-Fi and EMQX credentials. Local secrets files are ignored by Git.</li>
        <li>Select the ESP32 board and port from the Tools menu, then click Upload.</li>
        <li>Open Serial Monitor at 115200 baud and check the device connection messages.</li>
      </ol>
      <p>The Arduino sketch publishes device health metrics. Door-position and RFID readers require their own hardware and firmware support. The firmware currently uses <code>setInsecure()</code>; for production, install a CA certificate and validate TLS.</p>
    </>,
  },
  {
    id: "vercel",
    title: "7. Deploy to Vercel",
    icon: Cloud,
    body: <>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Import the GitHub repository into Vercel and set Root Directory to <code>web-dashboard</code>.</li>
        <li>Add the same environment variables under Project Settings → Environment Variables for Production and Preview.</li>
        <li>Add your Vercel domain to Supabase Redirect URLs, then redeploy.</li>
      </ol>
      <p>For username sign-in, also set <code>SUPABASE_SERVICE_ROLE_KEY</code> as a server-only variable without the NEXT_PUBLIC prefix. Never commit this key or expose it to the browser. The laptop simulator runs only while the laptop and process are on. For a continuous online demo, use an ESP32 or run the simulator on an always-on server.</p>
    </>,
  },
  {
    id: "topics",
    title: "8. MQTT topics",
    icon: Radio,
    body: <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-left text-xs">
          <tbody>{[["pintu", "OPEN/CLOSED door status"], ["rfid", "Card UID"], ["metrics", "Device health metrics JSON"], ["relay", "ON/OFF or OPEN/CLOSE command"]].map(([topic, desc]) => <tr key={topic} className="border-b border-slate-800"><td className="py-3 pr-5 font-mono text-cyan-200">jtd/esp32/garasi/{topic}</td><td className="py-3 text-slate-400">{desc}</td></tr>)}</tbody>
        </table>
      </div>
      <p>Subscription topic: <code>jtd/esp32/garasi/#</code>; control publish topic: <code>jtd/esp32/garasi/relay</code>.</p>
    </>,
  },
  {
    id: "help",
    title: "9. Troubleshooting",
    icon: CheckCircle2,
    body: <>
      <details className="rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer">Device not listed?</summary><p className="mt-2 text-slate-400">Check the devices table, column names, RLS policies, Supabase environment variables, and sign-in status.</p></details>
      <details className="rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer">MQTT disconnected or no data?</summary><p className="mt-2 text-slate-400">Check the host, credentials, WSS port 8084, EMQX status, ACL, and topic names.</p></details>
      <details className="rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer">Incorrect email authentication redirect?</summary><p className="mt-2 text-slate-400">Add localhost and your Vercel domain to Supabase Redirect URLs.</p></details>
    </>,
  },
];

export default function GuidePage() {
  return (
    <main className="min-h-screen w-full overflow-x-clip bg-[#07111e] text-slate-100">
      <header className="w-full border-b border-white/10">
        <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-300"><ArrowLeft size={17} /> Home</Link>
          <b className="text-center text-sm sm:text-base">Smart Garage Guide</b>
          <Link href="/login" className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 sm:px-4 sm:text-sm">Dashboard</Link>
        </nav>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-xs font-bold tracking-widest text-cyan-300">INSTALLATION &amp; USER GUIDE</p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Start with the simulator,<br /><span className="text-cyan-300">then move to a physical ESP32.</span></h1>
          <p className="mt-5 leading-7 text-slate-400">Follow these steps to set up Supabase, EMQX, the dashboard, simulator, and device. This guide helps your team get started with the project.</p>
          <Link href="/proposal-guide" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-300/10"><BookOpen size={16} /> Open the proposal writing guide <ArrowRight size={15} /></Link>
        </div>
        <div className="mt-9 grid min-w-0 gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:sticky lg:top-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Contents</p>
            <nav className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">{sections.map((section) => <a key={section.id} href={`#${section.id}`} className="min-w-0 break-words rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-cyan-200">{section.title}</a>)}</nav>
          </aside>
          <div className="min-w-0 space-y-4">
            {sections.map(({ id, title, icon: Icon, body }) => <section id={id} key={id} className="scroll-mt-6 min-w-0 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-7"><div className="mb-4 flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Icon size={20} /></span><h2 className="min-w-0 break-words text-xl font-semibold">{title}</h2></div><div className="min-w-0 space-y-4 break-words text-sm leading-7 text-slate-300">{body}</div></section>)}
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-6 sm:flex-row sm:items-center"><div><b>Ready to try it?</b><p className="text-sm text-slate-400">Sign in to monitor your devices.</p></div><Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950">Open dashboard <ArrowRight size={16} /></Link></div>
          </div>
        </div>
      </div>
    </main>
  );
}
