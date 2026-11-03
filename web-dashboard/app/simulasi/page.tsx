"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import mqtt, { type MqttClient } from "mqtt";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Cloud,
  Database,
  DoorClosed,
  Gauge,
  Home,
  LogOut,
  Maximize2,
  MessagesSquare,
  Pause,
  Play,
  Power,
  SkipBack,
  SkipForward,
  Wifi,
  WifiOff,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Device {
  id: string | number;
  device_name: string;
  device_type: string;
  topic_sub: string;
  topic_pub: string;
}

type Mode = "realtime" | "simulation";
type DoorState = "open" | "closed" | null;

interface LogEntry {
  id: number;
  time: string;
  topic: string;
  payload: string;
}

type SimulationScenario = "normal" | "web_down" | "power_out";

const simulationScenarios: Record<SimulationScenario, { label: string; steps: { title: string; description: string; node: number; event: string }[] }> = {
  normal: {
    label: "All systems normal",
    steps: [
      { title: "ESP32 is ready to connect", description: "The ESP32 is preparing to publish status and receive relay commands.", node: 0, event: "Device data sampled" },
      { title: "Data sent through Router A", description: "The ESP32 sends telemetry over Router A Wi-Fi and the internet connection.", node: 1, event: "Telemetry sent to the broker" },
      { title: "EMQX forwards MQTT messages", description: "The broker forwards device telemetry to the browser over MQTT WebSockets.", node: 2, event: "MQTT message forwarded" },
      { title: "Dashboard receives data", description: "The browser opens the Vercel website through Router B. Relay commands travel from the dashboard to EMQX and then to the ESP32.", node: 4, event: "Dashboard live · kontrol dua arah" },
    ],
  },
  web_down: {
    label: "Website / cloud outage",
    steps: [
      { title: "Cloud services are unavailable", description: "EMQX and Vercel are unavailable; the remote dashboard loses both its MQTT connection and website.", node: 0, event: "Cloud route unavailable" },
      { title: "ESP32 remains available locally", description: "The HTTP server runs directly on the ESP32 at port 80. Device status and the relay remain accessible while the ESP32 and Router A are powered.", node: 1, event: "ESP32 local server is active" },
      { title: "Router A connects to Router B", description: "Cross-network access is available only when inter-router intranet routing or WireGuard is configured and the link is active.", node: 2, event: "Checking the intranet route" },
      { title: "User opens the local dashboard", description: "Browser di Router B membuka alamat IP ESP32 melalui jalur Router A–B. Halaman ini disajikan ESP32, bukan Vercel.", node: 4, event: "Local monitoring across routers" },
    ],
  },
  power_out: {
    label: "Power outage",
    steps: [
      { title: "Mains power is lost", description: "Monitoring status depends on the UPS simulation switch.", node: 0, event: "Mains power outage" },
      { title: "UPS is off or unavailable", description: "The ESP32 and Router A are off, so no live garage data is available. Use a safe manual access procedure.", node: 1, event: "No backup power" },
      { title: "UPS powers the devices", description: "If the UPS powers the ESP32 and Router A, device readings and the ESP32 local page remain available.", node: 2, event: "Backup power is active" },
      { title: "User access depends on the route", description: "A phone on Router A can open the ESP32 IP. Access from Router B requires power for Router B and the inter-router intranet link.", node: 4, event: "Monitoring follows the available route" },
    ],
  },
};

const scenarioOptions: { id: SimulationScenario; label: string }[] = [
  { id: "normal", label: "All systems normal" },
  { id: "web_down", label: "Website / cloud outage" },
  { id: "power_out", label: "Power outage" },
];

const speeds = [
  { label: "Slow", interval: 2600 },
  { label: "Normal", interval: 1500 },
  { label: "Fast", interval: 700 },
];

function readMessage(payload: string) {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Most sensor and actuator topics use plain-text payloads.
  }
  return null;
}

function TopologyDevice({
  icon: Icon,
  title,
  detail,
  state,
  stateText,
}: {
  icon: typeof DoorClosed;
  title: string;
  detail: string;
  state: "active" | "standby" | "down" | "conditional";
  stateText: string;
}) {
  const stateStyles = {
    active: "border-emerald-300 bg-emerald-50 text-emerald-800",
    standby: "border-slate-200 bg-white text-slate-700",
    down: "border-rose-300 bg-rose-50 text-rose-800",
    conditional: "border-amber-300 bg-amber-50 text-amber-800",
  };

  return (
    <article className={`min-w-0 rounded-xl border p-3 shadow-sm sm:p-4 ${stateStyles[state]}`}>
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/80"><Icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold sm:text-sm">{title}</h3>
            <span className="rounded-full bg-white/80 px-2 py-1 text-[9px] font-bold uppercase tracking-wide">{stateText}</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 opacity-80">{detail}</p>
        </div>
      </div>
    </article>
  );
}

export default function SimulationPage() {
  const router = useRouter();
  const clientRef = useRef<MqttClient | null>(null);
  const subscribedTopicRef = useRef<string | null>(null);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<Mode>("realtime");
  const [scenario, setScenario] = useState<SimulationScenario>("normal");
  const [backupPowerOn, setBackupPowerOn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [mqttStatus, setMqttStatus] = useState("Not connected");
  const [mqttConnected, setMqttConnected] = useState(false);
  const [doorState, setDoorState] = useState<DoorState>(null);
  const [eventLabel, setEventLabel] = useState("Waiting for activity");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [commandStatus, setCommandStatus] = useState("");
  const currentSteps = simulationScenarios[scenario].steps;

  const appendLog = useCallback((topic: string, payload: string) => {
    setLogs((current) => [
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        topic,
        payload,
      },
      ...current,
    ].slice(0, 30));
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }

    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const isSignedIn = Boolean(session);
      setAuthenticated(isSignedIn);
      setAuthChecked(true);
      if (!isSignedIn) router.replace("/login");
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      const isSignedIn = Boolean(session);
      setAuthenticated(isSignedIn);
      setAuthChecked(true);
      if (!isSignedIn) router.replace("/login");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!authChecked || !authenticated || !supabase) return;
    let cancelled = false;

    void supabase
      .from("devices")
      .select("id, device_name, device_type, topic_sub, topic_pub")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setDeviceError(error.message);
          return;
        }
        const availableDevices = (data ?? []) as Device[];
        setDevices(availableDevices);
        setSelectedDevice(availableDevices[0] ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [authChecked, authenticated]);

  useEffect(() => {
    if (!authChecked || !authenticated || mode !== "realtime") return;

    const host = process.env.NEXT_PUBLIC_EMQX_HOST;
    const username = process.env.NEXT_PUBLIC_EMQX_USERNAME;
    const password = process.env.NEXT_PUBLIC_EMQX_PASSWORD;
    if (!host || !username || !password) {
      setMqttStatus("Broker configuration is incomplete");
      return;
    }

    setMqttStatus("Connecting...");
    const client = mqtt.connect(`wss://${host}:8084/mqtt`, {
      username,
      password,
      clientId: `garage-simulation-${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 10_000,
      reconnectPeriod: 3_000,
    });
    clientRef.current = client;

    client.on("connect", () => {
      setMqttStatus("Connected");
      setMqttConnected(true);
      subscribedTopicRef.current = null;
      appendLog("mqtt", "Connected to the EMQX Cloud broker");
    });
    client.on("reconnect", () => {
      setMqttStatus("Reconnecting...");
      setMqttConnected(false);
    });
    client.on("offline", () => {
      setMqttStatus("Offline");
      setMqttConnected(false);
    });
    client.on("close", () => setMqttConnected(false));
    client.on("error", (error) => {
      setMqttStatus("Connection error");
      appendLog("mqtt:error", error.message);
    });
    client.on("message", (topic, message) => {
      const payload = message.toString().trim();
      const suffix = topic.toLowerCase().split("/").pop() ?? "";
      const values = readMessage(payload);

      if (suffix === "metrics") {
        setEventLabel("Device telemetry received by the dashboard");
      } else if (suffix === "pintu") {
        const state = String(values?.state ?? values?.pintu ?? payload).toUpperCase();
        if (state.includes("BUKA") || state.includes("OPEN") || ["ON", "1", "TRUE"].includes(state)) setDoorState("open");
        else if (state.includes("TUTUP") || state.includes("CLOSE") || ["OFF", "0", "FALSE"].includes(state)) setDoorState("closed");
        setEventLabel("Door status received by the dashboard");
      } else if (suffix === "relay") {
        setEventLabel(`Relay command received by device: ${payload}`);
      } else {
        setEventLabel(`MQTT message received: ${suffix || "topic"}`);
      }

      appendLog(topic, payload || "(payload kosong)");
    });

    return () => {
      clientRef.current = null;
      subscribedTopicRef.current = null;
      setMqttConnected(false);
      client.end(true);
    };
  }, [authChecked, authenticated, mode, appendLog]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client?.connected || mode !== "realtime") return;

    const nextTopic = selectedDevice?.topic_sub.trim() || null;
    const previousTopic = subscribedTopicRef.current;
    if (nextTopic === previousTopic) return;

    const subscribe = () => {
      if (!nextTopic) {
        subscribedTopicRef.current = null;
        return;
      }
      client.subscribe(nextTopic, (error) => {
        if (error) {
          setMqttStatus("Subscription failed");
          appendLog("mqtt:error", `Failed to subscribe to ${nextTopic}: ${error.message}`);
          return;
        }
        subscribedTopicRef.current = nextTopic;
        setDoorState(null);
        appendLog("mqtt", `Mendengarkan ${nextTopic}`);
      });
    };

    if (previousTopic) client.unsubscribe(previousTopic, subscribe);
    else subscribe();
  }, [selectedDevice, mqttConnected, mode, appendLog]);

  useEffect(() => {
    if (!playing || mode !== "simulation") return;
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % currentSteps.length);
    }, speeds[speed].interval);
    return () => window.clearInterval(timer);
  }, [playing, mode, speed, currentSteps]);

  useEffect(() => {
    if (mode !== "simulation") return;
    const current = currentSteps[step];
    setEventLabel(current.title);
  }, [mode, step, currentSteps]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        void toggleFullscreen();
      }
      if (event.key === "ArrowRight") setStep((current) => (current + 1) % currentSteps.length);
      if (event.key === "ArrowLeft") setStep((current) => (current - 1 + currentSteps.length) % currentSteps.length);
    };
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  });

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await fullscreenRef.current?.requestFullscreen();
    else await document.exitFullscreen();
  }

  function setSimulationMode(nextMode: Mode) {
    setPlaying(false);
    setMode(nextMode);
    setEventLabel(nextMode === "simulation" ? currentSteps[step].title : "Waiting for MQTT activity");
  }

  function chooseScenario(nextScenario: SimulationScenario) {
    setPlaying(false);
    setScenario(nextScenario);
    setStep(0);
    setEventLabel(simulationScenarios[nextScenario].steps[0].title);
  }

  function publishCommand(command: "OPEN" | "CLOSE") {
    const client = clientRef.current;
    const topic = selectedDevice?.topic_pub.trim();
    if (!client?.connected || !topic) {
      setCommandStatus("The broker or command topic is not ready.");
      return;
    }

    client.publish(topic, command, { qos: 1 }, (error) => {
      if (error) {
        setCommandStatus(`Failed to send command: ${error.message}`);
        appendLog("mqtt:error", error.message);
        return;
      }
      setCommandStatus(`Command ${command} sent. Waiting for a device status update.`);
      setEventLabel(`Dashboard sent ${command} to the device`);
      appendLog(topic, command);
    });
  }


  async function logout() {
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (!authChecked || !authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#07111e] px-5 text-slate-100">
        <p className="rounded-2xl border border-white/10 bg-slate-900/80 px-6 py-5 text-sm text-slate-300">
          {supabase ? "Checking sign-in session..." : "Supabase is not configured."}
        </p>
      </main>
    );
  }

  const activeSimulationStep = currentSteps[step];
  const event = mode === "simulation" ? activeSimulationStep.event : eventLabel;
  const simulatedDevicePowered = scenario !== "power_out" || backupPowerOn;
  const powerOutDescriptions = backupPowerOn
    ? [
        "Mains power is out. When the UPS is enabled, the simulation assumes the ESP32 and Router A remain powered.",
        "The ESP32 continues to provide status and relay control through its local HTTP page on port 80.",
        "Router A keeps the garage Wi-Fi/LAN available while the UPS powers the network equipment.",
        "A phone on Router A can monitor the system directly. Access from Router B requires Router B and the inter-router intranet link to remain powered.",
      ]
    : [
        "Mains power is out and the UPS is off. The ESP32 and Router A lose power, so status and relay control are unavailable.",
        "The ESP32 local server is also offline because it has no power.",
        "Router A no longer provides Wi-Fi/LAN, so the intranet route from Router B cannot reach the ESP32.",
        "The dashboard receives no live data. Restore power or use a safe manual access procedure.",
      ];
  const activeSimulationDescription = scenario === "power_out" ? powerOutDescriptions[step] : activeSimulationStep.description;
  const cloudPathConditional = mode === "simulation" && scenario === "power_out" && simulatedDevicePowered;
  const cloudServicesDown = mode === "simulation" && scenario === "web_down";
  const localRouterRouteActive = mode === "simulation" && (scenario === "web_down" || (scenario === "power_out" && backupPowerOn));
  const localRouteAnimating = mode === "simulation" && localRouterRouteActive && playing;
  const cloudRouteAnimating = mode === "realtime" ? mqttConnected : mode === "simulation" && scenario === "normal" && playing;
  const powerIsOff = mode === "simulation" && scenario === "power_out" && !backupPowerOn;
  const connectionBadge = powerIsOff ? "No power" : cloudServicesDown ? "Cloud unavailable \u00b7 use local route" : cloudPathConditional ? "UPS active \u00b7 Router B access is conditional" : mode === "realtime" ? mqttConnected ? "MQTT connected" : "Waiting for MQTT" : playing ? "Route animation active" : "All services normal";


  return (
    <main ref={fullscreenRef} className="min-h-screen overflow-x-hidden bg-[#07111e] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_10%_0%,rgba(8,145,178,0.14),transparent_35%),radial-gradient(ellipse_at_88%_34%,rgba(109,40,217,0.10),transparent_38%)]" />

      <header className="relative z-10 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white sm:gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><DoorClosed size={19} /></span>
            <span><span className="block text-[10px] uppercase tracking-[0.2em] text-cyan-300">JTD · GARAGE IOT</span><span className="block">Smart Garage</span></span>
          </Link>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 hover:text-white"><Home size={14} /><span>Home</span></Link>
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 hover:text-white"><Gauge size={14} /><span>Dashboard</span></Link>
            <Link href="/panduan" className="hidden items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 hover:text-white sm:inline-flex"><BookOpen size={14} /><span>Guide</span></Link>
            <Link href="/forum" className="hidden items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 hover:text-white sm:inline-flex"><MessagesSquare size={14} /><span>Forum</span></Link>
            <button type="button" onClick={logout} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 hover:border-rose-400/40 hover:text-rose-200"><LogOut size={14} /><span>Sign out</span></button>
          </div>
        </nav>
      </header>

      <div className="relative z-0 mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-cyan-300">SYSTEM VISUALIZATION</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Smart Garage System Flow</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Choose a network or power scenario to see the primary monitoring route and the ESP32 local backup route.</p>
          </div>
          <div className="grid w-full grid-cols-2 rounded-2xl border border-slate-700 bg-slate-900/80 p-1 sm:w-auto">
            <button type="button" onClick={() => setSimulationMode("realtime")} className={`rounded-xl px-4 py-3 text-xs font-semibold transition sm:text-sm ${mode === "realtime" ? "bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30" : "text-slate-400 hover:text-white"}`}>
              <span className="flex items-center justify-center gap-2"><Activity size={15} /> Real-time</span>
            </button>
            <button type="button" onClick={() => setSimulationMode("simulation")} className={`rounded-xl px-4 py-3 text-xs font-semibold transition sm:text-sm ${mode === "simulation" ? "bg-violet-300 text-slate-950 shadow-lg shadow-violet-950/30" : "text-slate-400 hover:text-white"}`}>
              <span className="flex items-center justify-center gap-2"><Play size={15} /> Simulation</span>
            </button>
          </div>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active mode</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                  {mode === "simulation" ? <Activity size={15} className="text-violet-300" /> : mqttConnected ? <Wifi size={15} className="text-emerald-300" /> : <WifiOff size={15} className="text-rose-300" />}
                  {mode === "realtime" ? `MQTT ${mqttStatus}` : "Local simulation · broker not used"}
                </p>
              </div>
              {mode === "realtime" ? (
                <label className="flex w-full flex-col gap-1.5 text-xs text-slate-400 sm:w-72">
                  Device
                  <select value={selectedDevice ? String(selectedDevice.id) : ""} onChange={(e) => { setSelectedDevice(devices.find((item) => String(item.id) === e.target.value) ?? null); setCommandStatus(""); }} disabled={devices.length === 0} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/60 disabled:opacity-60">
                    {devices.length === 0 && <option value="">No devices available</option>}
                    {devices.map((device) => <option key={device.id} value={String(device.id)}>{device.device_name}</option>)}
                  </select>
                </label>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setStep((current) => (current - 1 + currentSteps.length) % currentSteps.length)} className="rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:text-white" aria-label="Previous step"><SkipBack size={17} /></button>
                  <button type="button" onClick={() => setPlaying((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-violet-200">{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Pause" : "Auto-play"}</button>
                  <button type="button" onClick={() => setStep((current) => (current + 1) % currentSteps.length)} className="rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:text-white" aria-label="Next step"><SkipForward size={17} /></button>
                  <label className="sr-only" htmlFor="simulation-speed">Simulation speed</label>
                  <select id="simulation-speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white">
                    {speeds.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}
                  </select>
                </div>
              )}
            </div>
            {mode === "simulation" && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
                {scenarioOptions.map((option) => (
                  <button key={option.id} type="button" onClick={() => chooseScenario(option.id)} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${scenario === option.id ? "border-violet-300/50 bg-violet-300/15 text-violet-100" : "border-slate-700 bg-slate-950/50 text-slate-400 hover:text-white"}`}>
                    {option.label}
                  </button>
                ))}
                {scenario === "power_out" && <button type="button" aria-pressed={backupPowerOn} onClick={() => setBackupPowerOn((value) => !value)} className={`ml-auto rounded-xl border px-3 py-2 text-xs font-semibold ${backupPowerOn ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-rose-300/30 bg-rose-300/10 text-rose-200"}`}>UPS: {backupPowerOn ? "Installed" : "Not available"}</button>}
              </div>
            )}
            {deviceError && mode === "realtime" && <p className="mt-2 text-xs text-rose-300">Failed to load devices: {deviceError}</p>}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] px-4 py-3 lg:block lg:px-5 lg:py-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Aktivitas terbaru</p><p className="mt-1 text-sm font-semibold text-white">{event}</p></div>
            {mode === "realtime" && <button type="button" onClick={() => publishCommand(doorState === "open" ? "CLOSE" : "OPEN")} disabled={!mqttConnected || !selectedDevice?.topic_pub} className="ml-3 shrink-0 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 lg:ml-0 lg:mt-3">{doorState === "open" ? "Send CLOSE" : "Send OPEN"}</button>}
          </div>
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]" aria-label="Smart Garage system flow simulation">
          <div className="min-w-0 rounded-3xl border border-slate-800 bg-slate-950/65 p-4 shadow-2xl shadow-black/20 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-semibold text-white">{mode === "simulation" ? `Topology: ${simulationScenarios[scenario].label}` : "Real-time system topology"}</h2><p className="mt-1 text-xs text-slate-500">ESP32 &rarr; Router A &rarr; EMQX; the browser uses Router B to access the Vercel UI and MQTT WSS.</p></div>
              <button type="button" onClick={() => void toggleFullscreen()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:border-cyan-300/40 hover:text-white"><Maximize2 size={14} />{fullscreen ? "Exit full screen" : "Full screen (F)"}</button>
            </div>

            <div className="rounded-2xl border border-slate-300 bg-slate-50 p-3 text-slate-800 shadow-inner sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-sky-700">System topology</p><h3 className="mt-1 text-sm font-extrabold sm:text-base">{mode === "simulation" ? `Flow: ${simulationScenarios[scenario].label}` : "Real-time monitoring flow"}</h3><p className="mt-1 text-[10px] text-slate-600 sm:text-xs">The garage, cloud, and user zones are connected according to the selected route.</p></div>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase ${powerIsOff ? "bg-rose-100 text-rose-800" : cloudServicesDown ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                  <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${powerIsOff ? "bg-rose-500" : cloudServicesDown ? "bg-amber-500" : "bg-emerald-500"} ${((cloudRouteAnimating || localRouteAnimating) && !powerIsOff) ? "animate-pulse" : ""}`} />{connectionBadge}
                </span>
              </div>

              <section className={`rounded-xl border-2 border-dashed p-3 sm:p-4 ${cloudServicesDown ? "border-rose-300 bg-rose-50" : "border-sky-300 bg-sky-50"}`}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-sky-800">Internet &amp; cloud zone</p><h4 className="mt-1 text-xs font-extrabold sm:text-sm">Remote services</h4><p className="mt-1 text-[10px] text-slate-600 sm:text-xs">EMQX carries MQTT messages; Vercel hosts the website. The browser connects directly to the broker.</p></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase ${cloudServicesDown ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>{cloudServicesDown ? "Cloud services down" : "Services active"}</span></div>
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,0.72fr)_2.5rem_minmax(0,1fr)] md:items-center">
                  <article className={`rounded-xl border p-3 shadow-sm ${cloudServicesDown ? "border-rose-300 bg-rose-100 text-rose-800" : mqttConnected || cloudRouteAnimating ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"}`}><div className="flex items-start gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white"><Cloud size={18} /></span><div className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs sm:text-sm">EMQX Cloud</strong><span className="rounded-full bg-white/80 px-2 py-1 text-[8px] font-bold uppercase">{cloudServicesDown ? "Down" : mqttConnected ? "Connected" : "MQTT broker"}</span></div><p className="mt-1 text-[10px] leading-4 opacity-75">TLS 8883 / WebSocket WSS 8084</p><p className="mt-1 break-all font-mono text-[9px] opacity-80">{selectedDevice?.topic_sub || "Device topic"}</p></div></div></article>
                  <div className={`flex items-center justify-center ${cloudRouteAnimating ? "text-cyan-600" : "text-slate-400"}`} aria-hidden="true"><span className="hidden h-px w-6 bg-current md:block" /><ArrowRight className={`rotate-90 md:rotate-0 ${cloudRouteAnimating ? "animate-pulse" : ""}`} size={18} />{cloudRouteAnimating && <span className="hidden h-1.5 w-1.5 animate-ping rounded-full bg-cyan-500 md:block" />}</div>
                  <article className="rounded-xl border border-sky-200 bg-white p-3 text-center shadow-sm"><Cloud className="mx-auto text-sky-700" size={19} /><strong className="mt-1 block text-xs text-sky-900">Internet / WAN</strong><span className="text-[9px] text-slate-500">Inter-network route</span></article>
                  <div className={`flex items-center justify-center ${cloudRouteAnimating ? "text-cyan-600" : "text-slate-400"}`} aria-hidden="true"><span className="hidden h-px w-6 bg-current md:block" /><ArrowRight className={`rotate-90 md:rotate-0 ${cloudRouteAnimating ? "animate-pulse" : ""}`} size={18} />{cloudRouteAnimating && <span className="hidden h-1.5 w-1.5 animate-ping rounded-full bg-cyan-500 md:block" />}</div>
                  <article className={`rounded-xl border p-3 shadow-sm ${cloudServicesDown ? "border-rose-300 bg-rose-100 text-rose-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}><div className="flex items-start gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white"><Gauge size={18} /></span><div><strong className="text-xs sm:text-sm">Dashboard Vercel</strong><p className="mt-1 text-[10px] leading-4 opacity-75">Next.js UI is served over HTTPS. MQTT.js in the browser opens a WSS connection directly to EMQX.</p></div></div></article>
                </div>
              </section>

              <div className="my-3 grid gap-2 md:grid-cols-2">
                <div className={`flex flex-wrap items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-[9px] font-bold sm:text-[10px] ${powerIsOff ? "border-rose-200 bg-rose-50 text-rose-700" : localRouterRouteActive ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-cyan-200 bg-cyan-50 text-cyan-800"}`}>
                  <span>ESP32</span><ArrowRight className={localRouteAnimating || cloudRouteAnimating ? "animate-pulse" : ""} size={13} /><span>Router A</span><ArrowRight className={localRouteAnimating || cloudRouteAnimating ? "animate-pulse" : ""} size={13} /><span>{localRouterRouteActive ? "Intranet / VPN link" : "Internet \u2192 EMQX"}</span>
                  {(localRouteAnimating || cloudRouteAnimating) && <span className="h-1.5 w-1.5 animate-ping rounded-full bg-cyan-500" />}
                </div>
                <div className={`flex flex-wrap items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-[9px] font-bold sm:text-[10px] ${powerIsOff ? "border-slate-200 bg-slate-100 text-slate-500" : localRouterRouteActive ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-violet-200 bg-violet-50 text-violet-800"}`}>
                  <span>{localRouterRouteActive ? "Router A" : "EMQX"}</span><ArrowRight className={localRouteAnimating || cloudRouteAnimating ? "animate-pulse" : ""} size={13} /><span>{localRouterRouteActive ? "Router B" : "Browser / Router B"}</span><span className="text-slate-500">{localRouterRouteActive ? "\u00b7 Intranet / VPN" : "\u00b7 MQTT WSS \u2194 EMQX \u00b7 Vercel HTTPS UI"}</span>
                  {(localRouteAnimating || cloudRouteAnimating) && <span className="h-1.5 w-1.5 animate-ping rounded-full bg-violet-500" />}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <section className={`rounded-xl border-2 border-dashed p-3 sm:p-4 ${powerIsOff ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50"}`}>
                  <div className="mb-3"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-800">Device zone</p><h4 className="mt-1 text-xs font-extrabold sm:text-sm">Garage area - Router A</h4><p className="mt-1 text-[10px] text-slate-600 sm:text-xs">Device Wi-Fi and local access</p></div>
                  <article className={`rounded-xl border p-3 shadow-sm ${powerIsOff ? "border-rose-300 bg-rose-100 text-rose-800" : "border-slate-200 bg-white text-slate-800"}`}><div className="flex items-start gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50"><Activity size={18} /></span><div><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs sm:text-sm">ESP32 + relay</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold uppercase">{powerIsOff ? "Off" : selectedDevice?.device_name || "Device"}</span></div><p className="mt-1 text-[10px] leading-4 opacity-75">Receives relay commands and serves the local HTTP dashboard on port 80.</p></div></div></article>
                  <div className={`flex flex-col items-center py-1 text-[9px] font-semibold ${powerIsOff ? "text-rose-500" : localRouteAnimating || cloudRouteAnimating ? "text-cyan-700" : "text-slate-500"}`}><span className={`h-4 w-px bg-current ${localRouteAnimating || cloudRouteAnimating ? "animate-pulse" : ""}`} /><ArrowRight className={`rotate-90 ${localRouteAnimating || cloudRouteAnimating ? "animate-pulse" : ""}`} size={16} /><span>Garage Wi-Fi / LAN</span></div>
                  <article className={`rounded-xl border p-3 shadow-sm ${powerIsOff ? "border-rose-300 bg-rose-100 text-rose-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}><div className="flex items-start gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white"><Wifi size={18} /></span><div><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs sm:text-sm">Router A</strong><span className="rounded-full bg-white/80 px-2 py-1 text-[8px] font-bold uppercase">{powerIsOff ? "Inactive" : cloudServicesDown ? "Local LAN" : cloudRouteAnimating ? "Connected" : "LAN active"}</span></div><p className="mt-1 text-[10px] leading-4 opacity-75">Local device gateway; the WAN route is used when available.</p></div></div></article>
                </section>

                <section className="rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 p-3 sm:p-4">
                  <div className="mb-3"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-teal-800">User zone</p><h4 className="mt-1 text-xs font-extrabold sm:text-sm">User area - Router B</h4><p className="mt-1 text-[10px] text-slate-600 sm:text-xs">Phone / laptop accesses the dashboard</p></div>
                  <article className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-800 shadow-sm"><div className="flex items-start gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white"><Wifi size={18} /></span><div><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs sm:text-sm">Router B / user internet</strong><span className="rounded-full bg-white/80 px-2 py-1 text-[8px] font-bold uppercase">{scenario === "power_out" && mode === "simulation" ? "Requires power" : localRouterRouteActive ? "Intranet / VPN" : "Internet"}</span></div><p className="mt-1 text-[10px] leading-4 opacity-75">The local route requires bidirectional routing or a Router A?B VPN.</p></div></div></article>
                  <div className={`flex flex-col items-center py-1 text-[9px] font-semibold ${localRouteAnimating || cloudRouteAnimating ? "text-cyan-700" : "text-slate-500"}`}><span className={`h-4 w-px bg-current ${localRouteAnimating || cloudRouteAnimating ? "animate-pulse" : ""}`} /><ArrowRight className={`rotate-90 ${localRouteAnimating || cloudRouteAnimating ? "animate-pulse" : ""}`} size={16} /><span>{localRouterRouteActive ? "Intranet / VPN" : "Browser / HTTPS + MQTT WSS"}</span></div>
                  <article className={`rounded-xl border p-3 shadow-sm ${powerIsOff ? "border-slate-200 bg-slate-100 text-slate-500" : "border-slate-200 bg-white text-slate-800"}`}><div className="flex items-start gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50"><Home size={18} /></span><div><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs sm:text-sm">{localRouterRouteActive ? "ESP32 local dashboard" : "Phone / laptop dashboard"}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold uppercase">{powerIsOff ? "Unavailable" : localRouterRouteActive ? "Local HTTP :80" : "Vercel + MQTT"}</span></div><p className="mt-1 text-[10px] leading-4 opacity-75">{localRouterRouteActive ? "Open the ESP32 IP from Router A or through the intranet/VPN link." : "Vercel serves the UI; the browser connects directly to EMQX over MQTT WSS."}</p></div></div></article>
                </section>
              </div>
            </div>
          </div>

          <aside className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">{mode === "simulation" ? "Simulation steps" : "System status"}</p>
            <h2 className="mt-2 text-lg font-semibold">{mode === "simulation" ? activeSimulationStep.title : selectedDevice?.device_name ?? "Select a device"}</h2>
            <p className="mt-2 min-h-[4.5rem] text-sm leading-6 text-slate-400">{mode === "simulation" ? activeSimulationDescription : eventLabel}</p>

            {mode === "simulation" ? (
              <>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setStep((current) => (current - 1 + currentSteps.length) % currentSteps.length)} className="flex-1 rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800"><span className="inline-flex items-center gap-1"><ArrowLeft size={14} />Previous</span></button>
                  <button type="button" onClick={() => setStep((current) => (current + 1) % currentSteps.length)} className="flex-1 rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800"><span className="inline-flex items-center gap-1">Next<ArrowRight size={14} /></span></button>
                </div>
                <ol className="mt-4 divide-y divide-slate-800">
                  {currentSteps.map((item, index) => <li key={item.title}><button type="button" onClick={() => { setStep(index); setPlaying(false); }} className={`flex w-full items-center gap-3 py-3 text-left text-xs transition ${index === step ? "font-semibold text-cyan-100" : "text-slate-500 hover:text-slate-200"}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] ${index === step ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200" : "border-slate-700"}`}>{index < step ? <Check size={12} /> : index + 1}</span><span>{item.title}</span></button></li>)}
                </ol>
                <p className="mt-3 border-t border-slate-800 pt-3 text-[11px] leading-5 text-slate-500">Shortcuts: ←/→ to change steps, F for full screen.</p>
              </>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Topic subscription</p><p className="mt-1 break-all font-mono text-xs text-cyan-100">{selectedDevice?.topic_sub || "—"}</p></div>
                </div>
                {commandStatus && <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-xs leading-5 text-amber-100">{commandStatus}</p>}
                {devices.length === 0 && <p className="mt-3 text-xs leading-5 text-amber-200">No devices found. Add a row to the Supabase <code>devices</code>.</p>}
              </>
            )}
          </aside>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-[#02070d] shadow-xl shadow-black/20" aria-label="Log pesan MQTT">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${mode === "simulation" ? "bg-violet-300" : mqttConnected ? "bg-emerald-300" : "bg-rose-300"}`} /><h2 className="font-mono text-xs font-semibold text-slate-200">{mode === "simulation" ? "SIMULATION LOG" : "LIVE MQTT LOG"}</h2></div><button type="button" onClick={() => setLogs([])} className="text-[11px] text-slate-500 hover:text-slate-200">Clear log</button></div>
          <div className="max-h-52 min-h-24 overflow-y-auto p-3 font-mono text-[11px] leading-5 sm:p-4">
            {mode === "simulation" ? <p className="text-violet-200"><span className="text-slate-600">[DEMO]</span> {String(step + 1).padStart(2, "0")} · {activeSimulationStep.title} — {activeSimulationStep.event}</p> : logs.length ? logs.map((entry) => <p key={entry.id} className="break-all text-emerald-100/90"><span className="text-slate-600">[{entry.time}]</span> <span className="text-cyan-200">{entry.topic}</span> · {entry.payload}</p>) : <p className="text-slate-600">Waiting for messages from the selected device...</p>}
          </div>
        </section>

        <p className="mt-4 text-center text-[11px] leading-5 text-slate-600">The topology shows relay control over MQTT and the ESP32 local HTTP dashboard. Simulation animations are illustrative; real-time mode reflects the broker connection status.</p>
      </div>
    </main>
  );
}
