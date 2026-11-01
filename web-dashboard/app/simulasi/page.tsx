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
  KeyRound,
  LogOut,
  Maximize2,
  MessagesSquare,
  Pause,
  Play,
  Power,
  RotateCw,
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
      { title: "Kartu RFID dibaca", description: "Pengguna menempelkan kartu/tag 13,56 MHz ke RC522. ESP32 membaca UID kartu.", node: 0, event: "UID RFID terbaca" },
      { title: "ESP32 memvalidasi UID", description: "ESP32 membandingkan UID dengan daftar kartu yang diizinkan di program. UID tidak dikenal ditolak dan servo tidak bergerak.", node: 1, event: "Validasi akses lokal" },
      { title: "Servo membuka gerbang", description: "Untuk UID terdaftar, ESP32 menggerakkan servo ke posisi buka. Reed switch memeriksa posisi fisik gerbang, bukan sekadar perintah servo.", node: 2, event: "Servo bergerak · reed memverifikasi" },
      { title: "Status tampil di web lokal", description: "Web server yang berjalan di ESP32 menampilkan status reed switch dan menerima perintah manual. Akses jarak jauh melewati MikroTik dengan VPN/DDNS yang dikonfigurasi.", node: 3, event: "Monitoring lokal tersedia" },
    ],
  },
  web_down: {
    label: "Website / cloud down",
    steps: [
      { title: "Akses internet / website cloud down", description: "Pengguna dari luar tidak dapat membuka dashboard cloud. Jalur akses RFID dan mekanisme kontrol lokal tetap bekerja karena berjalan di ESP32.", node: 2, event: "Akses jarak jauh terganggu" },
      { title: "Kartu RFID tetap divalidasi", description: "RC522 dan daftar UID tersimpan di ESP32; akses lokal tidak bergantung pada Vercel, EMQX, atau internet.", node: 0, event: "Kontrol RFID lokal aktif" },
      { title: "ESP32 menggerakkan servo", description: "UID terdaftar tetap dapat membuka gerbang. Reed switch tetap melaporkan posisi fisik selama rangkaian mendapat daya.", node: 1, event: "Akses gerbang lokal aktif" },
      { title: "Buka server lokal dari Wi-Fi garasi", description: "Hubungkan HP ke Wi-Fi yang sama dengan ESP32 lalu buka IP lokal board (contoh DHCP lease 192.168.88.50). Akses dari jaringan luar memerlukan VPN MikroTik dan WAN aktif.", node: 3, event: "Web lokal tetap tersedia" },
    ],
  },
  power_out: {
    label: "Listrik padam",
    steps: [
      { title: "Listrik utama terputus", description: "Tanpa UPS, ESP32, RC522, reed switch, servo, dan router tidak bekerja. Gerbang harus dioperasikan dengan cara manual yang aman.", node: 0, event: "Daya utama padam" },
      { title: "Periksa UPS", description: "UPS dapat memberi waktu operasi sementara. Pastikan ESP32 dan router mendapat daya; modem/ONT juga perlu UPS jika koneksi internet ingin bertahan.", node: 1, event: "Daya cadangan diperiksa" },
      { title: "Akses elektronik kembali aktif sementara", description: "Jika ESP32 mendapat daya dari UPS, RFID, reed switch, servo, dan web server lokal dapat berfungsi selama kapasitas baterai masih cukup.", node: 2, event: "Sistem aktif dengan UPS" },
      { title: "Akses manual saat UPS habis", description: "Ketika daya cadangan habis, web server dan aktuator mati. Gunakan kunci atau pelepas mekanis; monitoring jarak jauh juga terputus.", node: 3, event: "Akses manual diperlukan" },
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
  const [rfidValue, setRfidValue] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState(-1);
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
      setStep((current) => (current + 1) % currentSteps.length);
    }, speeds[speed].interval);
    return () => window.clearInterval(timer);
  }, [playing, mode, speed, currentSteps]);

  useEffect(() => {
    if (mode !== "simulation") return;
    const current = currentSteps[step];
    setActiveNode(current.node);
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
    setActiveNode(nextMode === "simulation" ? currentSteps[step].node : -1);
    setEventLabel(nextMode === "simulation" ? currentSteps[step].title : "Menunggu aktivitas MQTT");
  }

  function chooseScenario(nextScenario: SimulationScenario) {
    setPlaying(false);
    setScenario(nextScenario);
    setStep(0);
    setActiveNode(simulationScenarios[nextScenario].steps[0].node);
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

  const activeSimulationStep = currentSteps[step];
  const event = mode === "simulation" ? activeSimulationStep.event : eventLabel;
  const simulatedDevicePowered = scenario !== "power_out" || (backupPowerOn && step < 3);
  const displayTemperature = mode === "simulation" ? simulatedDevicePowered ? 24.2 + step * 0.3 : null : temperature;
  const displayHumidity = mode === "simulation" ? simulatedDevicePowered ? 58.4 + step * 0.4 : null : humidity;
  const displayDoorState = mode === "simulation" ? (step === 2 ? "open" : "closed") : doorState;
  const displayRfid = mode === "simulation" ? "JTD-DEMO-042" : rfidValue;
  const powerOutDescriptions = backupPowerOn
    ? [
        "PLN padam, tetapi UPS masih menyuplai ESP32 dan router. RFID, reed switch, servo, dan server lokal dapat bertahan selama baterai cukup.",
        "UPS perlu menyuplai ESP32 dan router. Modem/ONT juga perlu UPS bila akses VPN/DDNS dari luar ingin tetap tersedia.",
        "Akses kartu dan pembacaan posisi pintu berjalan sementara. Gerbang tetap hanya bergerak bila suplai servo juga tersedia.",
        "Anggap baterai UPS habis di tahap ini: ESP32 dan server lokal mati. Gunakan akses mekanis; akses remote juga terputus.",
      ]
    : [
        "PLN padam tanpa UPS. ESP32, RC522, reed switch, servo, dan router mati; sistem elektronik tidak dapat mengendalikan gerbang.",
        "UPS tidak tersedia. Tidak ada daya untuk ESP32 dan router; jangan mengandalkan monitoring elektronik.",
        "Tanpa UPS, akses RFID dan servo tetap tidak aktif. Gunakan mekanisme manual yang aman.",
        "Web server lokal dan akses remote tidak tersedia. Gunakan kunci atau pelepas mekanis pada gerbang.",
      ];
  const activeSimulationDescription = scenario === "power_out" ? powerOutDescriptions[step] : activeSimulationStep.description;
  const routeProgress = mode !== "simulation"
    ? -1
    : scenario === "normal"
      ? activeNode
      : scenario === "web_down"
        ? step === 1 ? 0 : step === 2 ? 1 : step === 3 ? 3 : -1
        : backupPowerOn && step === 2 ? 0 : -1;
  const localRouteActive = mode === "simulation" && simulatedDevicePowered && (
    (scenario === "web_down" && step === 3) ||
    (scenario === "power_out" && backupPowerOn && step === 3)
  );
  const cloudPathDown = mode === "simulation" && (scenario === "web_down" || (scenario === "power_out" && !simulatedDevicePowered));
  const cloudPathConditional = mode === "simulation" && scenario === "power_out" && simulatedDevicePowered;
  const routeNodes = [
    { icon: KeyRound, title: "RC522 membaca UID", detail: "Kartu/tag RFID 13,56 MHz" },
    { icon: Activity, title: "ESP32 validasi", detail: "Cek UID pada allow-list lokal" },
    { icon: RotateCw, title: "Servo bergerak", detail: "Buka/tutup gerbang model" },
    { icon: DoorClosed, title: "Reed konfirmasi", detail: "Posisi fisik tampil di web lokal" },
  ];

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

            <div className="rounded-2xl border border-slate-300 bg-slate-50 p-3 text-slate-800 shadow-inner sm:p-5">
              <section className={`rounded-xl border-2 border-dashed p-3 sm:p-4 ${scenario === "web_down" || (scenario === "power_out" && !backupPowerOn) ? "border-rose-300 bg-rose-50" : scenario === "power_out" && backupPowerOn ? "border-amber-300 bg-amber-50" : "border-sky-300 bg-sky-50"}`}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div><h3 className="text-xs font-extrabold sm:text-sm">Internet / layanan cloud</h3><p className="mt-1 text-[10px] text-slate-600 sm:text-xs">EMQX adalah broker MQTT; Vercel meng-host website. Keduanya layanan berbeda.</p></div>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase ${cloudPathDown ? "bg-rose-100 text-rose-800" : cloudPathConditional ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{scenario === "web_down" ? "Cloud down" : scenario === "power_out" && !simulatedDevicePowered ? "Tidak ada telemetry" : scenario === "power_out" ? "Tergantung UPS + WAN" : "Jalur normal"}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <TopologyDevice icon={Cloud} title="EMQX Cloud" detail="Broker MQTT · TLS 8883 / WSS 8084 · topik esp32/garasi" state={mode === "realtime" ? mqttConnected ? "active" : "standby" : scenario === "normal" ? "active" : scenario === "web_down" || !simulatedDevicePowered ? "down" : "conditional"} stateText={mode === "realtime" ? mqttConnected ? "Terhubung" : "Menunggu" : scenario === "normal" ? "Aktif" : scenario === "web_down" || !simulatedDevicePowered ? "Down" : "Kondisional"} />
                  <TopologyDevice icon={Gauge} title="Dashboard Vercel" detail="Next.js · dibuka pengguna melalui browser" state={mode === "realtime" ? "active" : scenario === "normal" ? "active" : scenario === "power_out" && simulatedDevicePowered ? "conditional" : "down"} stateText={mode === "realtime" ? "Website" : scenario === "normal" ? "Aktif" : scenario === "power_out" && simulatedDevicePowered ? "Kondisional" : "Down"} />
                </div>
              </section>

              <div className="my-2 text-center text-[10px] font-semibold text-slate-500 sm:my-3">Akses internet menghubungkan jaringan garasi dengan broker dan dashboard</div>
              <div className="grid gap-3 md:grid-cols-2">
                <section className={`rounded-xl border-2 border-dashed p-3 sm:p-4 ${!simulatedDevicePowered && mode === "simulation" ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50"}`}>
                  <div className="mb-3"><h3 className="text-xs font-extrabold sm:text-sm">Area garasi · Router A</h3><p className="mt-1 text-[10px] text-slate-600 sm:text-xs">Wi-Fi perangkat dan akses lokal</p></div>
                    <div className="grid gap-2">
                    <div className="grid gap-1">
                      <TopologyDevice icon={KeyRound} title="RFID RC522" detail="Membaca UID kartu/tag 13,56 MHz melalui SPI." state={mode === "simulation" ? !simulatedDevicePowered ? "down" : routeProgress === 0 ? "active" : "standby" : "standby"} stateText={mode === "simulation" ? !simulatedDevicePowered ? "Mati" : routeProgress === 0 ? "Tap kartu" : "Pembaca" : "SPI"} />
                      <span className={`justify-self-center text-lg font-bold ${mode === "simulation" && routeProgress === 0 ? "animate-bounce text-cyan-700" : "text-slate-300"}`} aria-hidden="true">↓</span>
                      <TopologyDevice icon={Activity} title="ESP32" detail="Memeriksa UID pada daftar kartu yang diizinkan; menjalankan web server lokal port 80." state={mode === "simulation" ? simulatedDevicePowered ? routeProgress === 1 ? "active" : "standby" : "down" : mqttConnected ? "active" : "standby"} stateText={mode === "simulation" ? simulatedDevicePowered ? routeProgress === 1 ? "Validasi" : "Kontrol" : "Mati" : mqttConnected ? "Online" : "Siap lokal"} />
                      <span className={`justify-self-center text-lg font-bold ${mode === "simulation" && routeProgress === 1 ? "animate-bounce text-cyan-700" : "text-slate-300"}`} aria-hidden="true">↓</span>
                      <TopologyDevice icon={RotateCw} title="Servo gerbang" detail="Menggerakkan model gerbang ke posisi buka/tutup; perlu catu daya 5 V terpisah." state={mode === "simulation" ? !simulatedDevicePowered ? "down" : routeProgress === 2 ? "active" : "standby" : "standby"} stateText={mode === "simulation" ? !simulatedDevicePowered ? "Mati" : routeProgress === 2 ? "Bergerak" : "Aktuator" : "PWM"} />
                    </div>
                    <div className={`flex flex-wrap items-center justify-center gap-2 rounded-lg border border-dashed px-2 py-2 text-center text-[10px] ${mode === "simulation" && routeProgress === 3 ? "animate-pulse border-cyan-400 bg-cyan-50 text-cyan-900" : "border-slate-300 bg-white/70 text-slate-600"}`}><DoorClosed size={14} /><strong>Reed switch di kusen</strong><span>· GPIO 4 · INPUT_PULLUP</span><span>→ memberi status pintu sebenarnya kembali ke ESP32</span></div>
                    <div className="flex flex-wrap items-center justify-center gap-2 text-center text-[9px] font-semibold text-slate-500 sm:text-[10px]"><span>ESP32 / WebServer</span><span className="text-cyan-700">⇄ Wi-Fi / LAN ⇄</span><span>Router A / MikroTik</span><span className="text-slate-400">→ internet / VPN bila diaktifkan</span></div>
                  </div>
                </section>

                <section className="rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 p-3 sm:p-4">
                  <div className="mb-3"><h3 className="text-xs font-extrabold sm:text-sm">Area pengguna · Router B</h3><p className="mt-1 text-[10px] text-slate-600 sm:text-xs">HP / laptop mengakses dashboard</p></div>
                  <div className="grid gap-2">
                    <TopologyDevice icon={Wifi} title="Router B / Internet pengguna" detail="Jaringan pengguna berbeda; jalur cloud memakai internet. Akses IP lokal butuh WireGuard jika dikonfigurasi." state={scenario === "normal" || mode === "realtime" ? "active" : scenario === "power_out" && simulatedDevicePowered ? "conditional" : "standby"} stateText={scenario === "normal" || mode === "realtime" ? "Internet" : scenario === "power_out" && simulatedDevicePowered ? "Kondisional" : "Terpisah"} />
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 text-center text-[9px] font-semibold text-slate-500 sm:text-[10px]"><span>Browser</span><span className="text-slate-400">&rarr;</span><span>Vercel / MQTT WSS</span></div>
                    <TopologyDevice icon={Home} title="Dashboard HP / laptop" detail={mode === "simulation" && scenario !== "normal" && simulatedDevicePowered ? "Akses halaman ESP32 dari Wi-Fi lokal; dari luar perlu VPN MikroTik." : mode === "simulation" && !simulatedDevicePowered ? "Offline; operasikan gerbang secara manual." : "Pantau status reed switch dan kirim perintah buka/tutup."} state={mode === "simulation" ? !simulatedDevicePowered ? "down" : scenario === "normal" ? "active" : "conditional" : mqttConnected ? "active" : "standby"} stateText={mode === "simulation" ? !simulatedDevicePowered ? "Offline" : scenario === "normal" ? "Remote" : "Pakai lokal" : mqttConnected ? "Live" : "Menunggu"} />
                  </div>
                </section>
              </div>

              <section className="mt-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4" aria-label="Jalur komunikasi real-time">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h3 className="text-xs font-extrabold sm:text-sm">Alur akses kartu dan verifikasi gerbang</h3><p className="mt-1 text-[10px] text-slate-500 sm:text-xs">Panah bergerak mengikuti tahap yang sedang diputar</p></div>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase ${cloudPathDown ? "bg-rose-50 text-rose-800" : cloudPathConditional ? "bg-amber-50 text-amber-800" : "bg-cyan-50 text-cyan-800"}`}>{cloudPathDown ? "Jalur remote terputus · lokal tetap" : cloudPathConditional ? "Remote tergantung UPS + WAN" : "Alur perangkat lokal"}</span>
                </div>
                <div className="mt-3 grid gap-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                  {routeNodes.map((node, index) => (
                    <Fragment key={node.title}>
                      <div className={`rounded-lg border p-2.5 transition-all duration-500 ${mode === "simulation" && !simulatedDevicePowered ? "border-rose-200 bg-rose-50 text-rose-800" : routeProgress === index ? "border-cyan-400 bg-cyan-50 text-cyan-900 shadow-md shadow-cyan-100" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                        <div className="flex items-center gap-2"><node.icon size={15} /><strong className="text-[11px]">{node.title}</strong></div>
                        <p className="mt-1 text-[9px] leading-4 opacity-75 sm:text-[10px]">{node.detail}</p>
                      </div>
                      {index < routeNodes.length - 1 && <span className={`justify-self-center text-lg font-bold transition-colors ${mode === "simulation" && !simulatedDevicePowered ? "text-rose-400" : routeProgress > index ? "animate-pulse text-cyan-600" : "text-slate-300"}`} aria-hidden="true">{mode === "simulation" && !simulatedDevicePowered ? "×" : <><span className="md:hidden">↓</span><span className="hidden md:inline">→</span></>}</span>}
                    </Fragment>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
                  <p className="text-[10px] leading-4 text-slate-600"><strong className="text-violet-800">Umpan balik pintu:</strong> reed switch → ESP32 → status OPEN/CLOSED pada web server.</p>
                  <p className="text-[10px] leading-4 text-slate-600"><strong className="text-sky-800">Akses remote:</strong> HP/laptop → internet → VPN MikroTik → web server ESP32. DDNS hanya nama alamat; bukan VPN.</p>
                </div>
              </section>

              <div className={`mt-3 rounded-xl border p-3 ${scenario === "web_down" || (scenario === "power_out" && backupPowerOn) ? "border-emerald-300 bg-emerald-50" : scenario === "power_out" ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}>
                <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs"><strong className="text-emerald-800">Jalur cadangan lokal:</strong><span className="rounded bg-white px-2 py-1">Server HTTP di ESP32 · port 80</span><span className={localRouteActive ? "animate-pulse font-black text-emerald-700" : "text-slate-400"} aria-hidden="true">&rarr;</span><span>Wi-Fi / LAN Router A</span><span className={localRouteActive ? "animate-pulse font-black text-emerald-700" : "text-slate-400"} aria-hidden="true">&rarr;</span><span>HP / laptop satu jaringan</span><span className="ml-auto font-bold">{!simulatedDevicePowered && mode === "simulation" ? "OFFLINE" : scenario === "web_down" || (scenario === "power_out" && backupPowerOn) ? "AKTIF" : "SIAP"}</span></div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] leading-4 text-slate-600"><span>Alamat: <code className="rounded bg-white px-1.5 py-0.5 text-cyan-800">http://192.168.88.50/</code> (jika DHCP lease tetap disetel; selain itu cek IP di Serial Monitor).</span><span>Jalur ini tidak melewati EMQX atau Vercel.</span></div>
                <details className="mt-2 border-t border-slate-200 pt-2 text-[10px] leading-4 text-slate-600">
                  <summary className="cursor-pointer font-bold text-slate-700">Server lokal itu apa dan bagaimana kerjanya?</summary>
                  <p className="mt-1">Bukan komputer/cloud terpisah. Sesuai proposal, firmware menjalankan HTTP server di ESP32 (port 80), menampilkan status reed switch, dan menerima perintah gerbang. RC522 memvalidasi UID di ESP32; servo membuka gerbang; reed switch mengonfirmasi posisi fisiknya. HP di Wi-Fi/LAN yang sama membuka IP ESP32. Dari luar, gunakan VPN MikroTik; DDNS hanya membantu menemukan alamat router.</p>
                </details>
              </div>
            </div>

            {mode === "simulation" && (
              <div className={`mt-4 rounded-2xl border p-4 ${scenario === "web_down" || (scenario === "power_out" && backupPowerOn) ? "border-emerald-300/30 bg-emerald-300/[0.06]" : scenario === "power_out" ? "border-rose-300/30 bg-rose-300/[0.05]" : "border-slate-700 bg-slate-900/50"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${scenario === "web_down" || (scenario === "power_out" && backupPowerOn) ? "text-emerald-200" : scenario === "power_out" ? "text-rose-200" : "text-slate-400"}`}>Jalur cadangan lokal ESP32</p>
                    <p className="mt-1 text-sm font-semibold text-white">ESP32 WebServer &rarr; HP di Wi-Fi Router A</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Buka <code className="text-cyan-200">http://192.168.88.50/</code> jika DHCP lease tetap sudah disetel. Jika belum, cek alamat IP di Serial Monitor. Dari Router B, akses melalui WireGuard jika WAN tersedia. Jalur lokal ini tidak melewati EMQX atau Vercel.</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${scenario === "web_down" || (scenario === "power_out" && backupPowerOn) ? "bg-emerald-300/10 text-emerald-200" : scenario === "power_out" ? "bg-rose-300/10 text-rose-200" : "bg-slate-800 text-slate-400"}`}>{!simulatedDevicePowered ? "Offline - tidak ada UPS" : scenario === "web_down" ? "Aktif - gunakan sekarang" : scenario === "power_out" ? "Aktif sementara - UPS" : "Siap digunakan"}</span>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {mode === "simulation" ? <>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-violet-200"><KeyRound size={15} /><span className="text-xs font-semibold">UID RFID terakhir</span></div><p className="mt-2 break-all text-lg font-semibold">{simulatedDevicePowered ? displayRfid : "OFFLINE"}</p></div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-cyan-200"><DoorClosed size={15} /><span className="text-xs font-semibold">Posisi pintu · reed</span></div><p className="mt-2 text-lg font-semibold">{!simulatedDevicePowered ? "OFFLINE" : displayDoorState === "open" ? "TERBUKA" : "TERTUTUP"}</p></div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-emerald-200"><RotateCw size={15} /><span className="text-xs font-semibold">Servo gerbang</span></div><p className="mt-2 text-lg font-semibold">{!simulatedDevicePowered ? "OFFLINE" : step === 2 ? "BUKA · 90°" : step === 3 ? "TUTUP OTOMATIS" : "SIAGA"}</p></div>
              </> : <>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-cyan-200"><Thermometer size={15} /><span className="text-xs font-semibold">Suhu</span></div><p className="mt-2 text-lg font-semibold">{formatValue(displayTemperature, "\u00b0C")}</p></div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-violet-200"><Activity size={15} /><span className="text-xs font-semibold">Kelembapan</span></div><p className="mt-2 text-lg font-semibold">{formatValue(displayHumidity, "%")}</p></div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex items-center gap-2 text-emerald-200"><Power size={15} /><span className="text-xs font-semibold">Status relay/pintu</span></div><p className="mt-2 text-lg font-semibold">{displayDoorState === "open" ? "ON / TERBUKA" : displayDoorState === "closed" ? "OFF / TERTUTUP" : "Menunggu data"}</p></div>
              </>}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-xs text-slate-400"><Database size={15} className="shrink-0 text-violet-300" /><span><strong className="text-slate-300">{mode === "simulation" ? "Topologi aktif" : "Supabase"}</strong> {mode === "simulation" ? scenario === "normal" ? "ESP32 -> Router A -> EMQX -> dashboard Vercel. Jalur lokal ESP32 tetap tersedia." : scenario === "web_down" ? "Jalur cloud ditandai down; gunakan halaman lokal ESP32. HP harus berada di Wi-Fi Router A atau lewat WireGuard dari Router B." : backupPowerOn ? "UPS menyalakan ESP32 dan Router A sementara. Backup monitoring berakhir saat daya UPS habis." : "Tanpa UPS, ESP32 dan Router A mati. Data tidak diperbarui; gunakan akses mekanis." : "menyimpan akun dan daftar perangkat; telemetry lewat EMQX."}</span></div>
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

        <p className="mt-4 text-center text-[11px] leading-5 text-slate-600">Mode simulasi mengikuti proposal: RC522 membaca UID, ESP32 memvalidasi kartu, servo menggerakkan gerbang, reed switch memastikan posisi fisik, dan server lokal ESP32 menampilkan status. Simulasi ini hanya ilustrasi; mode real-time membaca data MQTT perangkat terpilih.</p>
      </div>
    </main>
  );
}
