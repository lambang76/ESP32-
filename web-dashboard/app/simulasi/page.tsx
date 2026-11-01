"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import mqtt, { type MqttClient } from "mqtt";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Cloud,
  Database,
  DoorClosed,
  DoorOpen,
  Gauge,
  Home,
  LogOut,
  Maximize2,
  MessagesSquare,
  Pause,
  Play,
  Radio,
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

const simulationSteps = [
  {
    title: "Pemicu garasi terdeteksi",
    description: "Sensor DHT mengirim kondisi lingkungan. Status pintu dan tap RFID pada mode demo adalah data dummy.",
    node: 0,
    event: "Sensor / input",
  },
  {
    title: "ESP32 mengolah data",
    description: "ESP32 membaca sensor, menjalankan logika perangkat, lalu menyiapkan telemetry atau merespons perintah relay.",
    node: 0,
    event: "Pemrosesan perangkat",
  },
  {
    title: "Data melewati Wi-Fi",
    description: "Perangkat mengirim pesan melalui jaringan yang tersedia. Router hanya meneruskan koneksi internet.",
    node: 1,
    event: "Jaringan Wi-Fi",
  },
  {
    title: "EMQX merutekan MQTT",
    description: "Broker meneruskan pesan berdasarkan topic, misalnya suhu, kelembapan, metrics, pintu, RFID, atau relay.",
    node: 2,
    event: "Broker MQTT",
  },
  {
    title: "Dashboard menerima update",
    description: "Dashboard memperbarui kartu metrik dan log. Tombol kontrol mengirim perintah kembali ke topic relay.",
    node: 3,
    event: "Dashboard web",
  },
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

function DiagramNode({
  icon: Icon,
  number,
  title,
  subtitle,
  detail,
  active,
  good,
}: {
  icon: typeof DoorClosed;
  number: string;
  title: string;
  subtitle: string;
  detail: string;
  active: boolean;
  good?: boolean;
}) {
  return (
    <article
      className={`relative min-w-0 rounded-2xl border p-4 transition-all duration-500 sm:p-5 ${
        active
          ? "border-cyan-300/60 bg-cyan-300/[0.10] shadow-[0_0_35px_rgba(34,211,238,0.14)]"
          : "border-slate-700/70 bg-slate-900/75"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${active ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-200" : "border-slate-700 bg-slate-800 text-slate-300"}`}>
          <Icon size={22} />
        </span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${good ? "bg-emerald-300/10 text-emerald-200" : active ? "bg-cyan-300/10 text-cyan-200" : "bg-slate-800 text-slate-500"}`}>
          {good ? "Terhubung" : `0${number}`}
        </span>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-white sm:text-base">{title}</h3>
      <p className="mt-1 text-xs font-medium text-cyan-200/80">{subtitle}</p>
      <p className="mt-3 min-h-[2.5rem] text-xs leading-5 text-slate-400">{detail}</p>
    </article>
  );
}

export default function SimulationPage() {
  const router = useRouter();
  const clientRef = useRef<MqttClient | null>(null);
  const subscribedTopicRef = useRef<string | null>(null);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<Mode>("realtime");
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
  const [rfidValue, setRfidValue] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState(-1);
  const [eventLabel, setEventLabel] = useState("Menunggu aktivitas");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [commandStatus, setCommandStatus] = useState("");

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
        setActiveNode(3);
        setEventLabel("Dashboard menerima data suhu");
      } else if (["kelembapan", "humidity", "hum"].includes(suffix)) {
        const value = Number(values?.humidity ?? values?.hum ?? values?.kelembapan ?? payload);
        if (Number.isFinite(value)) setHumidity(value);
        setActiveNode(3);
        setEventLabel("Dashboard menerima data kelembapan");
      } else if (suffix === "metrics") {
        setActiveNode(3);
        setEventLabel("Telemetry perangkat diterima dashboard");
      } else if (suffix === "pintu") {
        const state = String(values?.state ?? values?.pintu ?? payload).toUpperCase();
        if (state.includes("BUKA") || state.includes("OPEN") || ["ON", "1", "TRUE"].includes(state)) setDoorState("open");
        else if (state.includes("TUTUP") || state.includes("CLOSE") || ["OFF", "0", "FALSE"].includes(state)) setDoorState("closed");
        setActiveNode(3);
        setEventLabel("Status pintu diterima dashboard");
      } else if (suffix === "rfid") {
        const value = values?.uid ?? values?.card_uid ?? values?.authorized_user ?? payload;
        setRfidValue(String(value));
        setActiveNode(3);
        setEventLabel("Aktivitas RFID diterima dashboard");
      } else if (suffix === "relay") {
        setActiveNode(0);
        setEventLabel(`Perintah relay diterima perangkat: ${payload}`);
      } else {
        setActiveNode(3);
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
        setRfidValue(null);
        appendLog("mqtt", `Mendengarkan ${nextTopic}`);
      });
    };

    if (previousTopic) client.unsubscribe(previousTopic, subscribe);
    else subscribe();
  }, [selectedDevice, mqttConnected, mode, appendLog]);

  useEffect(() => {
    if (!playing || mode !== "simulation") return;
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % simulationSteps.length);
    }, speeds[speed].interval);
    return () => window.clearInterval(timer);
  }, [playing, mode, speed]);

  useEffect(() => {
    if (mode !== "simulation") return;
    const current = simulationSteps[step];
    setActiveNode(current.node);
    setEventLabel(current.title);
  }, [mode, step]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        void toggleFullscreen();
      }
      if (event.key === "ArrowRight") setStep((current) => (current + 1) % simulationSteps.length);
      if (event.key === "ArrowLeft") setStep((current) => (current - 1 + simulationSteps.length) % simulationSteps.length);
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
    setActiveNode(nextMode === "simulation" ? simulationSteps[step].node : -1);
    setEventLabel(nextMode === "simulation" ? simulationSteps[step].title : "Menunggu aktivitas MQTT");
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
      setActiveNode(0);
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

  const activeSimulationStep = simulationSteps[step];
  const event = mode === "simulation" ? activeSimulationStep.event : eventLabel;
  const displayTemperature = mode === "simulation" ? 24.2 + step * 0.3 : temperature;
  const displayHumidity = mode === "simulation" ? 58.4 + step * 0.4 : humidity;
  const displayDoorState = mode === "simulation" ? (step >= 2 && step < 4 ? "open" : "closed") : doorState;
  const displayRfid = mode === "simulation" ? "JTD-DEMO-042" : rfidValue;

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
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Lihat perjalanan data sensor dan perintah relay dari ESP32, melalui broker MQTT, hingga dashboard.</p>
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
                  <button type="button" onClick={() => setStep((current) => (current - 1 + simulationSteps.length) % simulationSteps.length)} className="rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:text-white" aria-label="Langkah sebelumnya"><SkipBack size={17} /></button>
                  <button type="button" onClick={() => setPlaying((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-violet-200">{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Jeda" : "Putar otomatis"}</button>
                  <button type="button" onClick={() => setStep((current) => (current + 1) % simulationSteps.length)} className="rounded-xl border border-slate-700 p-2.5 text-slate-300 hover:text-white" aria-label="Langkah berikutnya"><SkipForward size={17} /></button>
                  <label className="sr-only" htmlFor="simulation-speed">Kecepatan simulasi</label>
                  <select id="simulation-speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white">
                    {speeds.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}
                  </select>
                </div>
              )}
            </div>
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
              <div><h2 className="font-semibold text-white">Jalur data perangkat</h2><p className="mt-1 text-xs text-slate-500">ESP32 → jaringan → EMQX Cloud → dashboard</p></div>
              <button type="button" onClick={() => void toggleFullscreen()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:border-cyan-300/40 hover:text-white"><Maximize2 size={14} />{fullscreen ? "Keluar layar penuh" : "Layar penuh (F)"}</button>
            </div>

            <div className="grid items-stretch gap-2 xl:grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)_28px_minmax(0,1fr)_28px_minmax(0,1fr)]">
              <DiagramNode icon={displayDoorState === "open" ? DoorOpen : DoorClosed} number="1" title="Garasi · ESP32" subtitle={selectedDevice?.device_name ?? "Perangkat IoT"} detail={`DHT ${formatValue(displayTemperature, " °C")} · ${formatValue(displayHumidity, "%")} · Pintu ${displayDoorState === "open" ? "TERBUKA" : displayDoorState === "closed" ? "TERTUTUP" : "--"}`} active={activeNode === 0} />
              <div className="hidden items-center justify-center text-cyan-300 xl:flex"><ArrowRight size={20} className={activeNode >= 1 ? "animate-pulse" : "text-slate-700"} /></div>
              <div className="flex items-center justify-center text-cyan-300 xl:hidden"><ArrowDown size={18} className={activeNode >= 1 ? "animate-pulse" : "text-slate-700"} /></div>
              <DiagramNode icon={Wifi} number="2" title="Wi-Fi / Internet" subtitle="Jaringan router" detail="ESP32 terhubung ke internet untuk komunikasi MQTT TLS." active={activeNode === 1} />
              <div className="hidden items-center justify-center text-cyan-300 xl:flex"><ArrowRight size={20} className={activeNode >= 2 ? "animate-pulse" : "text-slate-700"} /></div>
              <div className="flex items-center justify-center text-cyan-300 xl:hidden"><ArrowDown size={18} className={activeNode >= 2 ? "animate-pulse" : "text-slate-700"} /></div>
              <DiagramNode icon={Cloud} number="3" title="EMQX Cloud" subtitle="Broker MQTT" detail="Merutekan telemetry dan command berdasarkan topic perangkat." active={activeNode === 2} good={mode === "realtime" && mqttConnected} />
              <div className="hidden items-center justify-center text-cyan-300 xl:flex"><ArrowRight size={20} className={activeNode >= 3 ? "animate-pulse" : "text-slate-700"} /></div>
              <div className="flex items-center justify-center text-cyan-300 xl:hidden"><ArrowDown size={18} className={activeNode >= 3 ? "animate-pulse" : "text-slate-700"} /></div>
              <DiagramNode icon={Activity} number="4" title="Web Dashboard" subtitle="Next.js · MQTT over WSS" detail={`Suhu ${formatValue(displayTemperature, " °C")} · RFID ${displayRfid ?? "menunggu"}`} active={activeNode === 3} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-cyan-200"><Thermometer size={15} /><span className="text-xs font-semibold">Suhu</span></div><p className="mt-2 text-lg font-semibold">{formatValue(displayTemperature, " °C")}</p></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-violet-200"><Radio size={15} /><span className="text-xs font-semibold">RFID terakhir</span></div><p className="mt-2 truncate text-sm font-semibold">{displayRfid ?? "Belum ada data"}</p></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-emerald-200"><DoorClosed size={15} /><span className="text-xs font-semibold">Status pintu</span></div><p className="mt-2 text-sm font-semibold">{displayDoorState === "open" ? "TERBUKA" : displayDoorState === "closed" ? "TERTUTUP" : "Menunggu data"}</p></div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-xs text-slate-400"><Database size={15} className="shrink-0 text-violet-300" /><span><strong className="text-slate-300">Supabase</strong> menyimpan akun dan daftar perangkat; alur telemetry melewati broker MQTT.</span></div>
            {mode === "simulation" && <p className="mt-3 text-xs leading-5 text-amber-200/80">Mode simulasi hanya menggerakkan ilustrasi. Tidak membuat data palsu di broker dan tidak mengendalikan relay sungguhan.</p>}
          </div>

          <aside className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">{mode === "simulation" ? "Urutan simulasi" : "Status sistem"}</p>
            <h2 className="mt-2 text-lg font-semibold">{mode === "simulation" ? activeSimulationStep.title : selectedDevice?.device_name ?? "Pilih perangkat"}</h2>
            <p className="mt-2 min-h-[4.5rem] text-sm leading-6 text-slate-400">{mode === "simulation" ? activeSimulationStep.description : eventLabel}</p>

            {mode === "simulation" ? (
              <>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setStep((current) => (current - 1 + simulationSteps.length) % simulationSteps.length)} className="flex-1 rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800"><span className="inline-flex items-center gap-1"><ArrowLeft size={14} />Sebelumnya</span></button>
                  <button type="button" onClick={() => setStep((current) => (current + 1) % simulationSteps.length)} className="flex-1 rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800"><span className="inline-flex items-center gap-1">Berikutnya<ArrowRight size={14} /></span></button>
                </div>
                <ol className="mt-4 divide-y divide-slate-800">
                  {simulationSteps.map((item, index) => <li key={item.title}><button type="button" onClick={() => { setStep(index); setPlaying(false); }} className={`flex w-full items-center gap-3 py-3 text-left text-xs transition ${index === step ? "font-semibold text-cyan-100" : "text-slate-500 hover:text-slate-200"}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] ${index === step ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200" : "border-slate-700"}`}>{index < step ? <Check size={12} /> : index + 1}</span><span>{item.title}</span></button></li>)}
                </ol>
                <p className="mt-3 border-t border-slate-800 pt-3 text-[11px] leading-5 text-slate-500">Pintasan: ←/→ untuk langkah, F untuk layar penuh.</p>
              </>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Topic subscription</p><p className="mt-1 break-all font-mono text-xs text-cyan-100">{selectedDevice?.topic_sub || "—"}</p></div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">RFID terakhir</p><p className="mt-1 break-all text-sm font-semibold text-violet-100">{displayRfid ?? "Belum ada tap"}</p></div>
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

        <p className="mt-4 text-center text-[11px] leading-5 text-slate-600">Mode real-time menampilkan pesan yang benar-benar diterima. RFID dan status posisi pintu hanya muncul bila perangkat mengirim topic tersebut; simulator dummy dapat mempublikasikannya.</p>
      </div>
    </main>
  );
}
