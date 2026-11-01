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
  Thermometer,
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
    label: "Semua normal",
    steps: [
      { title: "ESP32 membaca sensor", description: "ESP32 membaca suhu dan kelembapan DHT22, lalu menyiapkan status relay.", node: 0, event: "Data sensor dibaca" },
      { title: "Data keluar lewat Router A", description: "ESP32 mengirim telemetry melalui Wi-Fi Router A dan koneksi internet.", node: 1, event: "Telemetry menuju broker" },
      { title: "EMQX meneruskan MQTT", description: "Broker menerima suhu/kelembapan dan meneruskan pesan ke klien dashboard melalui MQTT over WebSockets.", node: 2, event: "Pesan MQTT diteruskan" },
      { title: "Dashboard menerima data", description: "Browser membuka website di Vercel melalui Router B. Perintah relay kembali dari dashboard ke EMQX lalu ke ESP32.", node: 4, event: "Dashboard live · kontrol dua arah" },
    ],
  },
  web_down: {
    label: "Website / cloud down",
    steps: [
      { title: "Layanan cloud terputus", description: "EMQX/Vercel tidak bisa dipakai; dashboard remote kehilangan jalur MQTT dan website.", node: 0, event: "Jalur cloud terputus" },
      { title: "ESP32 tetap melayani lokal", description: "HTTP server port 80 berjalan langsung di ESP32. Sensor dan relay tetap dapat dipantau selama ESP32 dan Router A menyala.", node: 1, event: "Server lokal ESP32 aktif" },
      { title: "Router A terhubung ke Router B", description: "Akses lintas jaringan hanya tersedia jika routing intranet atau WireGuard antar-router sudah dikonfigurasi dan link-nya aktif.", node: 2, event: "Jalur intranet diperiksa" },
      { title: "Pengguna membuka dashboard lokal", description: "Browser di Router B membuka alamat IP ESP32 melalui jalur Router A–B. Halaman ini disajikan ESP32, bukan Vercel.", node: 4, event: "Monitoring lokal lintas router" },
    ],
  },
  power_out: {
    label: "Listrik padam",
    steps: [
      { title: "Listrik PLN terputus", description: "Status monitoring ditentukan oleh posisi sakelar simulasi UPS.", node: 0, event: "Listrik utama padam" },
      { title: "UPS mati atau tidak ada", description: "ESP32 dan Router A mati; tidak ada data live dari garasi. Gunakan akses manual yang aman.", node: 1, event: "Tidak ada daya cadangan" },
      { title: "UPS menyuplai perangkat", description: "Jika UPS menyalakan ESP32 dan Router A, pembacaan sensor dan halaman lokal ESP32 tetap berjalan.", node: 2, event: "Daya cadangan aktif" },
      { title: "Akses pengguna bergantung jalur", description: "HP di Router A dapat membuka IP ESP32. Akses dari Router B hanya berjalan jika Router B dan link intranet antar-router juga mendapat daya.", node: 4, event: "Monitoring sesuai jalur yang hidup" },
    ],
  },
};

const scenarioOptions: { id: SimulationScenario; label: string }[] = [
  { id: "normal", label: "Semua normal" },
  { id: "web_down", label: "Website / cloud down" },
  { id: "power_out", label: "Listrik padam" },
];

const speeds = [
  { label: "Lambat", interval: 2600 },
  { label: "Normal", interval: 1500 },
  { label: "Cepat", interval: 700 },
];

function formatValue(value: number | null, suffix = "") {
  return value === null ? "--" : `${value.toFixed(1)}${suffix}`;
}

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
  const [mqttStatus, setMqttStatus] = useState("Belum tersambung");
  const [mqttConnected, setMqttConnected] = useState(false);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [doorState, setDoorState] = useState<DoorState>(null);
  const [eventLabel, setEventLabel] = useState("Menunggu aktivitas");
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
        time: new Date().toLocaleTimeString("id-ID", { hour12: false }),
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
      setMqttStatus("Konfigurasi broker belum lengkap");
      return;
    }

    setMqttStatus("Menyambungkan...");
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
      setMqttStatus("Terhubung");
      setMqttConnected(true);
      subscribedTopicRef.current = null;
      appendLog("mqtt", "Terhubung ke broker EMQX Cloud");
    });
    client.on("reconnect", () => {
      setMqttStatus("Menyambungkan ulang...");
      setMqttConnected(false);
    });
    client.on("offline", () => {
      setMqttStatus("Offline");
      setMqttConnected(false);
    });
    client.on("close", () => setMqttConnected(false));
    client.on("error", (error) => {
      setMqttStatus("Kesalahan koneksi");
      appendLog("mqtt:error", error.message);
    });
    client.on("message", (topic, message) => {
      const payload = message.toString().trim();
      const suffix = topic.toLowerCase().split("/").pop() ?? "";
      const values = readMessage(payload);

      if (["suhu", "temperature", "temp"].includes(suffix)) {
        const value = Number(values?.temperature ?? values?.temp ?? values?.suhu ?? payload);
        if (Number.isFinite(value)) setTemperature(value);
        setEventLabel("Dashboard menerima data suhu");
      } else if (["kelembapan", "humidity", "hum"].includes(suffix)) {
        const value = Number(values?.humidity ?? values?.hum ?? values?.kelembapan ?? payload);
        if (Number.isFinite(value)) setHumidity(value);
        setEventLabel("Dashboard menerima data kelembapan");
      } else if (suffix === "metrics") {
        setEventLabel("Telemetry perangkat diterima dashboard");
      } else if (suffix === "pintu") {
        const state = String(values?.state ?? values?.pintu ?? payload).toUpperCase();
        if (state.includes("BUKA") || state.includes("OPEN") || ["ON", "1", "TRUE"].includes(state)) setDoorState("open");
        else if (state.includes("TUTUP") || state.includes("CLOSE") || ["OFF", "0", "FALSE"].includes(state)) setDoorState("closed");
        setEventLabel("Status pintu diterima dashboard");
      } else if (suffix === "relay") {
        setEventLabel(`Perintah relay diterima perangkat: ${payload}`);
      } else {
        setEventLabel(`Pesan MQTT diterima: ${suffix || "topic"}`);
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
          setMqttStatus("Gagal subscribe");
          appendLog("mqtt:error", `Gagal subscribe ${nextTopic}: ${error.message}`);
          return;
        }
        subscribedTopicRef.current = nextTopic;
        setTemperature(null);
        setHumidity(null);
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
    setEventLabel(nextMode === "simulation" ? currentSteps[step].title : "Menunggu aktivitas MQTT");
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
      setCommandStatus("Broker atau topic perintah belum siap.");
      return;
    }

    client.publish(topic, command, { qos: 1 }, (error) => {
      if (error) {
        setCommandStatus(`Gagal mengirim perintah: ${error.message}`);
        appendLog("mqtt:error", error.message);
        return;
      }
      setCommandStatus(`Perintah ${command} terkirim. Menunggu status balik dari perangkat.`);
      setEventLabel(`Dashboard mengirim ${command} ke perangkat`);
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
          {supabase ? "Memeriksa sesi login..." : "Konfigurasi Supabase belum tersedia."}
        </p>
      </main>
    );
  }

  const activeSimulationStep = currentSteps[step];
  const event = mode === "simulation" ? activeSimulationStep.event : eventLabel;
  const simulatedDevicePowered = scenario !== "power_out" || backupPowerOn;
  const displayTemperature = mode === "simulation" ? simulatedDevicePowered ? 24.2 + step * 0.3 : null : temperature;
  const displayHumidity = mode === "simulation" ? simulatedDevicePowered ? 58.4 + step * 0.4 : null : humidity;
  const displayDoorState = mode === "simulation" ? (step === 2 ? "open" : "closed") : doorState;
  const powerOutDescriptions = backupPowerOn
    ? [
        "PLN padam. Dengan UPS dinyalakan, simulasi menganggap ESP32 dan Router A tetap mendapat daya.",
        "ESP32 tetap membaca DHT22 dan melayani halaman lokal HTTP port 80.",
        "Router A menjaga Wi-Fi/LAN garasi selama UPS masih menyuplai perangkat jaringan tersebut.",
        "HP di Router A dapat memantau langsung. Akses dari Router B perlu Router B dan link intranet antar-router tetap menyala.",
      ]
    : [
        "PLN padam dan UPS mati. ESP32 serta Router A kehilangan daya; tidak ada pembacaan sensor atau kontrol relay.",
        "Server lokal ESP32 ikut mati karena tidak mendapat catu daya.",
        "Router A tidak memancarkan Wi-Fi/LAN, sehingga jalur intranet dari Router B tidak dapat mencapai ESP32.",
        "Dashboard tidak menerima data live. Pulihkan daya atau gunakan prosedur akses manual yang aman.",
      ];
  const activeSimulationDescription = scenario === "power_out" ? powerOutDescriptions[step] : activeSimulationStep.description;
  const localRouteActive = mode === "simulation" && simulatedDevicePowered && (scenario === "web_down" || scenario === "power_out");
  const cloudPathDown = mode === "simulation" && scenario === "web_down";
  const cloudPathConditional = mode === "simulation" && scenario === "power_out" && simulatedDevicePowered;
  const cloudRouteActive = mode === "realtime" || (mode === "simulation" && scenario === "normal");
  const localRouterRouteActive = mode === "simulation" && (scenario === "web_down" || (scenario === "power_out" && backupPowerOn));
  const routeNodes = mode === "realtime" || scenario === "normal"
    ? [
        { icon: Activity, title: "ESP32", detail: "DHT22 + relay · telemetry" },
        { icon: Wifi, title: "Router A", detail: "Wi-Fi garasi" },
        { icon: Cloud, title: "Internet / WAN", detail: "Jalur ke broker" },
        { icon: Activity, title: "EMQX Cloud", detail: "MQTT TLS 8883" },
        { icon: Gauge, title: "Dashboard Vercel", detail: "UI HTTPS ? browser lanjut ke EMQX WSS" },
        { icon: Home, title: "Pengguna · Router B", detail: "MQTT client di browser ? Router B" },
      ]
    : scenario === "web_down"
      ? [
          { icon: Activity, title: "ESP32 WebServer", detail: "Dashboard lokal · HTTP :80" },
          { icon: Wifi, title: "Router A", detail: "Wi-Fi / LAN garasi" },
          { icon: ArrowRight, title: "Link intranet A ↔ B", detail: "Routing / VPN harus aktif" },
          { icon: Wifi, title: "Router B", detail: "Jaringan pengguna" },
          { icon: Home, title: "Browser pengguna", detail: "Buka IP lokal ESP32" },
        ]
      : backupPowerOn
        ? [
            { icon: Power, title: "PLN padam", detail: "Sumber utama mati" },
            { icon: Power, title: "UPS menyala", detail: "Menyuplai ESP32 + Router A" },
            { icon: Activity, title: "ESP32 lokal", detail: "Sensor + HTTP :80 aktif" },
            { icon: Wifi, title: "Router A \u2194 B", detail: "Intranet/VPN + Router B perlu daya" },
            { icon: Home, title: "Dashboard lokal", detail: "Buka alamat IP ESP32" },
          ]
        : [
            { icon: Power, title: "PLN padam", detail: "Daya utama terputus" },
            { icon: Power, title: "UPS mati", detail: "Tidak ada daya cadangan" },
            { icon: Activity, title: "ESP32 + Router A", detail: "Mati · tidak ada data live" },
            { icon: WifiOff, title: "Jalur monitoring", detail: "Lokal dan cloud terputus" },
            { icon: Home, title: "Akses manual", detail: "Dashboard tidak tersedia" },
          ];
  const routeProgress = mode === "realtime" ? (mqttConnected ? routeNodes.length - 1 : -1) : Math.round((step / Math.max(1, currentSteps.length - 1)) * (routeNodes.length - 1));



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
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 hover:text-white"><Home size={14} /><span>Beranda</span></Link>
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 hover:text-white"><Gauge size={14} /><span>Dashboard</span></Link>
            <Link href="/panduan" className="hidden items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 hover:text-white sm:inline-flex"><BookOpen size={14} /><span>Panduan</span></Link>
            <Link href="/forum" className="hidden items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 hover:text-white sm:inline-flex"><MessagesSquare size={14} /><span>Forum</span></Link>
            <button type="button" onClick={logout} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 hover:border-rose-400/40 hover:text-rose-200"><LogOut size={14} /><span>Keluar</span></button>
          </div>
        </nav>
      </header>

      <div className="relative z-0 mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-cyan-300">VISUALISASI SISTEM</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Alur Smart Garage</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Pilih kondisi jaringan atau listrik untuk melihat jalur monitoring utama dan cadangan lokal ESP32.</p>
          </div>
          <div className="grid w-full grid-cols-2 rounded-2xl border border-slate-700 bg-slate-900/80 p-1 sm:w-auto">
            <button type="button" onClick={() => setSimulationMode("realtime")} className={`rounded-xl px-4 py-3 text-xs font-semibold transition sm:text-sm ${mode === "realtime" ? "bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30" : "text-slate-400 hover:text-white"}`}>
              <span className="flex items-center justify-center gap-2"><Activity size={15} /> Real-time</span>
            </button>
            <button type="button" onClick={() => setSimulationMode("simulation")} className={`rounded-xl px-4 py-3 text-xs font-semibold transition sm:text-sm ${mode === "simulation" ? "bg-violet-300 text-slate-950 shadow-lg shadow-violet-950/30" : "text-slate-400 hover:text-white"}`}>
              <span className="flex items-center justify-center gap-2"><Play size={15} /> Simulasi</span>
            </button>
          </div>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mode aktif</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                  {mode === "simulation" ? <Activity size={15} className="text-violet-300" /> : mqttConnected ? <Wifi size={15} className="text-emerald-300" /> : <WifiOff size={15} className="text-rose-300" />}
                  {mode === "realtime" ? `MQTT ${mqttStatus}` : "Simulasi lokal · tidak memakai broker"}
                </p>
              </div>
              {mode === "realtime" ? (
                <label className="flex w-full flex-col gap-1.5 text-xs text-slate-400 sm:w-72">
                  Perangkat
                  <select value={selectedDevice ? String(selectedDevice.id) : ""} onChange={(e) => { setSelectedDevice(devices.find((item) => String(item.id) === e.target.value) ?? null); setCommandStatus(""); }} disabled={devices.length === 0} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/60 disabled:opacity-60">
                    {devices.length === 0 && <option value="">Tidak ada perangkat</option>}
                    {devices.map((device) => <option key={device.id} value={String(device.id)}>{device.device_name}</option>)}
                  </select>
                </label>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setStep((current) => (current - 1 + currentSteps.length) % currentSteps.length)} className="rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:text-white" aria-label="Langkah sebelumnya"><SkipBack size={17} /></button>
                  <button type="button" onClick={() => setPlaying((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-violet-200">{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Jeda" : "Putar otomatis"}</button>
                  <button type="button" onClick={() => setStep((current) => (current + 1) % currentSteps.length)} className="rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:text-white" aria-label="Langkah berikutnya"><SkipForward size={17} /></button>
                  <label className="sr-only" htmlFor="simulation-speed">Kecepatan simulasi</label>
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
                {scenario === "power_out" && <button type="button" aria-pressed={backupPowerOn} onClick={() => setBackupPowerOn((value) => !value)} className={`ml-auto rounded-xl border px-3 py-2 text-xs font-semibold ${backupPowerOn ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-rose-300/30 bg-rose-300/10 text-rose-200"}`}>UPS: {backupPowerOn ? "Terpasang" : "Tidak ada"}</button>}
              </div>
            )}
            {deviceError && mode === "realtime" && <p className="mt-2 text-xs text-rose-300">Gagal memuat perangkat: {deviceError}</p>}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] px-4 py-3 lg:block lg:px-5 lg:py-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Aktivitas terbaru</p><p className="mt-1 text-sm font-semibold text-white">{event}</p></div>
            {mode === "realtime" && <button type="button" onClick={() => publishCommand(doorState === "open" ? "CLOSE" : "OPEN")} disabled={!mqttConnected || !selectedDevice?.topic_pub} className="ml-3 shrink-0 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 lg:ml-0 lg:mt-3">{doorState === "open" ? "Kirim CLOSE" : "Kirim OPEN"}</button>}
          </div>
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]" aria-label="Simulasi alur sistem Smart Garage">
          <div className="min-w-0 rounded-3xl border border-slate-800 bg-slate-950/65 p-4 shadow-2xl shadow-black/20 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-semibold text-white">{mode === "simulation" ? `Topologi: ${simulationScenarios[scenario].label}` : "Topologi sistem real-time"}</h2><p className="mt-1 text-xs text-slate-500">ESP32 &rarr; Router A &rarr; EMQX; browser via Router B membuka UI Vercel dan MQTT WSS.</p></div>
              <button type="button" onClick={() => void toggleFullscreen()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:border-cyan-300/40 hover:text-white"><Maximize2 size={14} />{fullscreen ? "Keluar layar penuh" : "Layar penuh (F)"}</button>
            </div>

            <div className="relative rounded-2xl border border-slate-300 bg-slate-50 p-3 text-slate-800 shadow-inner sm:p-5">
              <section className={`rounded-xl border-2 border-dashed p-3 sm:p-4 ${scenario === "web_down" && mode === "simulation" ? "border-rose-300 bg-rose-50" : scenario === "power_out" && backupPowerOn && mode === "simulation" ? "border-amber-300 bg-amber-50" : "border-sky-300 bg-sky-50"}`}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-sky-800">Zona internet &amp; cloud</p>
                  <div><h3 className="text-xs font-extrabold sm:text-sm">Layanan jarak jauh</h3><p className="mt-1 text-[10px] text-slate-600 sm:text-xs">EMQX adalah broker MQTT; Vercel meng-host website. Keduanya layanan berbeda.</p></div></div>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase ${cloudPathDown ? "bg-rose-100 text-rose-800" : cloudPathConditional ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{scenario === "web_down" && mode === "simulation" ? "Cloud down \u00b7 jalur lokal" : scenario === "power_out" && !backupPowerOn ? "ESP32 offline \u00b7 cloud tetap ada" : scenario === "power_out" ? "UPS aktif \u00b7 intranet bersyarat" : "Jalur normal"}</span>
                </div>
                <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_190px_minmax(0,1fr)]">
                  <div className="relative z-20"><TopologyDevice icon={Cloud} title="EMQX Cloud" detail="Broker MQTT · TLS 8883 / WSS 8084 · topik esp32/garasi" state={scenario === "web_down" && mode === "simulation" ? "down" : "active"} stateText={scenario === "web_down" && mode === "simulation" ? "Tidak tersedia" : mode === "realtime" && mqttConnected ? "Terhubung" : "Layanan aktif"} /></div>
                  <div className={`relative z-20 flex min-h-[74px] flex-col items-center justify-center rounded-xl border px-3 py-2 text-center shadow-sm ${cloudPathDown ? "border-rose-200 bg-rose-50 text-rose-800" : cloudPathConditional ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-white text-sky-900"}`}><Cloud size={19} className={mode === "simulation" && playing && scenario === "normal" ? "animate-pulse" : ""} /><strong className="mt-1 text-xs">Internet / WAN</strong><span className="text-[9px]">Jalur antarjaringan</span></div>
                  <div className="relative z-20"><TopologyDevice icon={Gauge} title="Dashboard Vercel" detail="Next.js · dibuka pengguna melalui browser" state={scenario === "web_down" && mode === "simulation" ? "down" : "active"} stateText={scenario === "web_down" && mode === "simulation" ? "Tidak tersedia" : "Website aktif"} /></div>
                </div>
              </section>

              <div aria-hidden="true" className="h-12" />
              <div className="grid gap-3 md:grid-cols-2">
                <section className={`rounded-xl border-2 border-dashed p-3 sm:p-4 ${!simulatedDevicePowered && mode === "simulation" ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50"}`}>
                  <div className="mb-3"><p className="text-[9px] font-bold uppercase tracking-[0.16em]">Zona perangkat</p><h3 className="text-xs font-extrabold sm:text-sm">Area garasi · Router A</h3><p className="mt-1 text-[10px] text-slate-600 sm:text-xs">Wi-Fi perangkat dan akses lokal</p></div>
                    <div className="grid gap-2">
                      <div className="relative z-20"><TopologyDevice icon={Activity} title="ESP32 + DHT22 + relay" detail="Publish suhu/kelembapan MQTT; menyediakan dashboard HTTP lokal :80." state={mode === "simulation" && !simulatedDevicePowered ? "down" : mode === "realtime" && mqttConnected ? "active" : localRouterRouteActive ? "active" : "standby"} stateText={mode === "simulation" && !simulatedDevicePowered ? "Mati" : mode === "realtime" ? mqttConnected ? "MQTT live" : "Siap lokal" : localRouterRouteActive ? "Lokal aktif" : "Perangkat"} /></div>
                      <div className={`flex flex-col items-center gap-1 py-1 text-[10px] font-semibold ${localRouterRouteActive ? "text-emerald-700" : cloudRouteActive ? "text-cyan-700" : "text-slate-400"}`}><ArrowRight className="rotate-90" size={18} /><span>Wi-Fi / LAN garasi</span></div>
                      <div className="relative z-20"><TopologyDevice icon={Wifi} title="Router A" detail="Gateway lokal ESP32; meneruskan MQTT ke WAN saat tersedia." state={mode === "simulation" && !simulatedDevicePowered ? "down" : scenario === "power_out" && backupPowerOn ? "conditional" : "active"} stateText={mode === "simulation" && !simulatedDevicePowered ? "Mati" : scenario === "power_out" && backupPowerOn ? "UPS" : "LAN aktif"} /></div>
                    </div>
                </section>

                <section className="rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 p-3 sm:p-4">
                  <div className="mb-3"><p className="text-[9px] font-bold uppercase tracking-[0.16em]">Zona pengguna</p><h3 className="text-xs font-extrabold sm:text-sm">Area pengguna · Router B</h3><p className="mt-1 text-[10px] text-slate-600 sm:text-xs">HP / laptop mengakses dashboard</p></div>
                  <div className="grid gap-2">
                    <div className="relative z-20"><TopologyDevice icon={Wifi} title="Router B / jaringan pengguna" detail={localRouterRouteActive ? "Akses dashboard ESP32 lewat link intranet/VPN Router A\u2013B yang sudah aktif." : "Jalur internet pengguna untuk membuka Vercel dan koneksi MQTT WSS."} state={mode === "simulation" && !simulatedDevicePowered ? "standby" : localRouterRouteActive ? "active" : scenario === "power_out" && backupPowerOn ? "conditional" : "active"} stateText={mode === "simulation" && !simulatedDevicePowered ? "Cek daya" : localRouterRouteActive ? "Intranet" : scenario === "power_out" && backupPowerOn ? "Bersyarat" : "Internet"} /></div>
                    <div className={`flex flex-col items-center gap-1 py-1 text-[10px] font-semibold ${localRouterRouteActive ? "text-emerald-700" : cloudRouteActive ? "text-teal-700" : "text-slate-400"}`}><ArrowRight className="rotate-90" size={18} /><span>{localRouterRouteActive ? "Link intranet / VPN" : "Browser / internet"}</span></div>
                    <div className="relative z-20"><TopologyDevice icon={Home} title={localRouterRouteActive ? "Dashboard lokal ESP32" : "Dashboard HP / laptop"} detail={mode === "simulation" && scenario === "web_down" && simulatedDevicePowered ? "Buka IP lokal ESP32 dari jaringan Router B melalui link intranet/VPN." : mode === "simulation" && scenario === "power_out" && !simulatedDevicePowered ? "Offline. Tidak ada telemetry live; gunakan akses manual." : mode === "simulation" && scenario === "power_out" ? "Dashboard lokal tersedia bila Router B dan link antar-router juga mendapat daya." : mode === "simulation" && scenario === "normal" ? "Pantau telemetry dari Vercel; perintah relay kembali melalui EMQX." : "Vercel menyajikan UI; MQTT WSS membawa telemetry dan perintah."} state={mode === "simulation" && !simulatedDevicePowered ? "down" : localRouterRouteActive ? "active" : mode === "simulation" && scenario === "power_out" ? "conditional" : mqttConnected ? "active" : "standby"} stateText={mode === "simulation" && !simulatedDevicePowered ? "Offline" : localRouterRouteActive ? "Lokal" : mode === "simulation" && scenario === "power_out" ? "Bersyarat" : mqttConnected ? "Live" : "Menunggu"} /></div>
                  </div>
                </section>
              </div>

              <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4" aria-label="Alur jaringan skenario aktif">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-extrabold sm:text-sm">{mode === "realtime" ? "Alur real-time: sensor dan perintah relay" : `Alur simulasi: ${simulationScenarios[scenario].label}`}</h3>
                    <p className="mt-1 text-[10px] text-slate-500 sm:text-xs">Ikuti setiap segmen dari sumber sampai dashboard; panah menunjukkan arah jalurnya.</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase ${!simulatedDevicePowered && mode === "simulation" ? "bg-rose-100 text-rose-800" : localRouterRouteActive ? "bg-emerald-100 text-emerald-800" : cloudPathConditional ? "bg-amber-100 text-amber-800" : mqttConnected && mode === "realtime" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>
                    {!simulatedDevicePowered && mode === "simulation" ? "Tidak ada monitoring live" : scenario === "web_down" && mode === "simulation" ? "Jalur lokal tanpa cloud" : cloudPathConditional ? "Lokal aktif; remote bersyarat" : mode === "realtime" ? mqttConnected ? "MQTT terhubung" : "Menunggu MQTT" : "Jalur cloud aktif"}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-1.5">
                  {routeNodes.map((node, index) => {
                    const isOffline = mode === "simulation" && scenario === "power_out" && !backupPowerOn;
                    const isReached = routeProgress >= index && !isOffline;
                    const isCurrent = routeProgress === index && !isOffline;
                    return <Fragment key={node.title}>
                      <article className={`min-w-0 flex-1 rounded-lg border p-2.5 transition-all duration-500 ${isOffline ? "border-rose-200 bg-rose-50 text-rose-800" : isCurrent ? "animate-pulse border-cyan-400 bg-cyan-50 text-cyan-900 shadow-md shadow-cyan-100" : isReached ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                        <div className="flex items-start gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white"><node.icon size={15} /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wide opacity-60">Segmen {index + 1}</p><strong className="block text-[11px] leading-4">{node.title}</strong></div></div>
                        <p className="mt-2 text-[9px] leading-4 opacity-75 sm:text-[10px]">{node.detail}</p>
                      </article>
                      {index < routeNodes.length - 1 && <span className={`flex shrink-0 items-center justify-center rounded-full ${isOffline ? "text-rose-400" : isReached ? "animate-pulse text-cyan-600" : "text-slate-300"}`} aria-hidden="true">{isOffline ? <WifiOff size={17} /> : <><ArrowRight className="hidden sm:block" size={18} /><ArrowRight className="rotate-90 sm:hidden" size={18} /></>}</span>}
                    </Fragment>;
                  })}
                </div>

                <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
                  <p className="text-[10px] leading-4 text-slate-600"><strong className="text-cyan-800">{mode === "simulation" && scenario === "web_down" ? "Dashboard cadangan:" : "Telemetry:"}</strong> {mode === "simulation" && scenario === "web_down" ? "Halaman HTTP disajikan ESP32 di port 80. Router B hanya dapat membukanya jika link intranet/WireGuard Router A\u2013B sudah aktif; alamat yang dibuka adalah IP lokal ESP32, bukan Vercel." : mode === "simulation" && scenario === "power_out" ? backupPowerOn ? "UPS pada simulasi menyuplai ESP32 dan Router A. Akses dari Router B tetap mensyaratkan router B serta link antar-router mendapat daya." : "UPS mati: ESP32 dan Router A tidak mengirim data. Dashboard tidak punya telemetry baru; gunakan akses manual." : "Telemetry: ESP32 \u2192 Router A \u2192 Internet \u2192 EMQX \u2192 browser (MQTT WSS). UI dimuat terpisah dari Vercel; perintah kembali melalui EMQX ke ESP32."}</p>
                  <p className="text-[10px] leading-4 text-slate-600"><strong className="text-violet-800">Jalur kontrol:</strong> {mode === "simulation" && scenario === "web_down" ? "Dashboard lokal \u2192 Router B \u2192 link intranet/VPN \u2192 Router A \u2192 relay ESP32. Pastikan routing dua arah dan firewall mengizinkan akses." : mode === "simulation" && scenario === "power_out" ? backupPowerOn ? "Lokal berjalan selama UPS dan perangkat jaringan yang diperlukan masih menyala; saat baterai habis jalur berhenti." : "Tanpa suplai UPS, seluruh kontrol elektronik berhenti." : "Browser \u2192 Vercel untuk membuka UI; MQTT WSS ke EMQX untuk melihat telemetry dan mengirim ON/OFF."}</p>
                </div>
              </section>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-cyan-200"><Thermometer size={15} /><span className="text-xs font-semibold">Suhu DHT22</span></div><p className="mt-2 text-lg font-semibold">{mode === "simulation" && !simulatedDevicePowered ? "OFFLINE" : formatValue(displayTemperature, " \u00b0C")}</p></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-violet-200"><Activity size={15} /><span className="text-xs font-semibold">Kelembapan DHT22</span></div><p className="mt-2 text-lg font-semibold">{mode === "simulation" && !simulatedDevicePowered ? "OFFLINE" : formatValue(displayHumidity, "%")}</p></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-emerald-200"><Power size={15} /><span className="text-xs font-semibold">Relay</span></div><p className="mt-2 text-lg font-semibold">{mode === "simulation" && !simulatedDevicePowered ? "OFFLINE" : displayDoorState === null ? "Menunggu data" : displayDoorState === "open" ? "ON" : "OFF"}</p></div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-xs text-slate-400"><Database size={15} className="shrink-0 text-violet-300" /><span><strong className="text-slate-300">{mode === "simulation" ? "Topologi aktif" : "Supabase"}</strong> {mode === "simulation" ? scenario === "normal" ? "ESP32 \u2192 Router A \u2192 EMQX \u2192 dashboard Vercel. Jalur lokal ESP32 tetap tersedia." : scenario === "web_down" ? "Jalur cloud ditandai down; gunakan halaman lokal ESP32. HP harus berada di Wi-Fi Router A atau lewat WireGuard dari Router B." : backupPowerOn ? "UPS menyalakan ESP32 dan Router A sementara. Backup monitoring berakhir saat daya UPS habis." : "Tanpa UPS, ESP32 dan Router A mati. Data tidak diperbarui; gunakan akses mekanis." : "menyimpan akun dan daftar perangkat; telemetry lewat EMQX."}</span></div>
            {mode === "simulation" && scenario === "power_out" && <p className="mt-3 text-xs leading-5 text-amber-200/90">Simulasi listrik padam: pembacaan sensor dan kontrol elektronik hanya berlanjut jika UPS juga menyuplai ESP32 dan Router A. Untuk akses lewat Router B, modem/ONT dan koneksi WAN juga perlu tetap hidup.</p>}
          </div>

          <aside className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">{mode === "simulation" ? "Urutan simulasi" : "Status sistem"}</p>
            <h2 className="mt-2 text-lg font-semibold">{mode === "simulation" ? activeSimulationStep.title : selectedDevice?.device_name ?? "Pilih perangkat"}</h2>
            <p className="mt-2 min-h-[4.5rem] text-sm leading-6 text-slate-400">{mode === "simulation" ? activeSimulationDescription : eventLabel}</p>

            {mode === "simulation" ? (
              <>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setStep((current) => (current - 1 + currentSteps.length) % currentSteps.length)} className="flex-1 rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800"><span className="inline-flex items-center gap-1"><ArrowLeft size={14} />Sebelumnya</span></button>
                  <button type="button" onClick={() => setStep((current) => (current + 1) % currentSteps.length)} className="flex-1 rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800"><span className="inline-flex items-center gap-1">Berikutnya<ArrowRight size={14} /></span></button>
                </div>
                <ol className="mt-4 divide-y divide-slate-800">
                  {currentSteps.map((item, index) => <li key={item.title}><button type="button" onClick={() => { setStep(index); setPlaying(false); }} className={`flex w-full items-center gap-3 py-3 text-left text-xs transition ${index === step ? "font-semibold text-cyan-100" : "text-slate-500 hover:text-slate-200"}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] ${index === step ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200" : "border-slate-700"}`}>{index < step ? <Check size={12} /> : index + 1}</span><span>{item.title}</span></button></li>)}
                </ol>
                <p className="mt-3 border-t border-slate-800 pt-3 text-[11px] leading-5 text-slate-500">Pintasan: ←/→ untuk langkah, F untuk layar penuh.</p>
              </>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Topic subscription</p><p className="mt-1 break-all font-mono text-xs text-cyan-100">{selectedDevice?.topic_sub || "—"}</p></div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Kelembapan</p><p className="mt-1 text-sm font-semibold text-cyan-100">{formatValue(displayHumidity, "%")}</p></div>
                </div>
                {commandStatus && <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-xs leading-5 text-amber-100">{commandStatus}</p>}
                {devices.length === 0 && <p className="mt-3 text-xs leading-5 text-amber-200">Belum ada perangkat. Tambahkan baris di tabel Supabase <code>devices</code>.</p>}
              </>
            )}
          </aside>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-[#02070d] shadow-xl shadow-black/20" aria-label="Log pesan MQTT">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${mode === "simulation" ? "bg-violet-300" : mqttConnected ? "bg-emerald-300" : "bg-rose-300"}`} /><h2 className="font-mono text-xs font-semibold text-slate-200">{mode === "simulation" ? "SIMULATION LOG" : "LIVE MQTT LOG"}</h2></div><button type="button" onClick={() => setLogs([])} className="text-[11px] text-slate-500 hover:text-slate-200">Bersihkan log</button></div>
          <div className="max-h-52 min-h-24 overflow-y-auto p-3 font-mono text-[11px] leading-5 sm:p-4">
            {mode === "simulation" ? <p className="text-violet-200"><span className="text-slate-600">[DEMO]</span> {String(step + 1).padStart(2, "0")} · {activeSimulationStep.title} — {activeSimulationStep.event}</p> : logs.length ? logs.map((entry) => <p key={entry.id} className="break-all text-emerald-100/90"><span className="text-slate-600">[{entry.time}]</span> <span className="text-cyan-200">{entry.topic}</span> · {entry.payload}</p>) : <p className="text-slate-600">Menunggu pesan dari perangkat terpilih...</p>}
          </div>
        </section>

        <p className="mt-4 text-center text-[11px] leading-5 text-slate-600">Topologi mengikuti firmware saat ini: ESP32 membaca DHT22, mengendalikan relay, mengirim telemetry lewat MQTT, dan menyediakan halaman HTTP lokal. Simulasi hanya ilustrasi; mode real-time membaca data perangkat melalui MQTT.</p>
      </div>
    </main>
  );
}
