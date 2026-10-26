"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import mqtt, { type MqttClient } from "mqtt";
import {
  Activity,
  ChevronDown,
  Clock3,
  Cpu,
  DoorClosed,
  DoorOpen,
  HardDrive,
  Home,
  KeyRound,
  LogOut,
  Power,
  Signal,
  Terminal,
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

interface TerminalEntry {
  id: number;
  time: string;
  topic: string;
  payload: string;
}

type DoorState = "open" | "closed" | null;

interface DeviceMetrics {
  freeHeapBytes: number | null;
  totalHeapBytes: number | null;
  minFreeHeapBytes: number | null;
  cpuUsagePercent: number | null;
  cpuFrequencyMHz: number | null;
  uptimeSeconds: number | null;
  wifiRssiDbm: number | null;
  flashSizeBytes: number | null;
}

const EMPTY_METRICS: DeviceMetrics = {
  freeHeapBytes: null,
  totalHeapBytes: null,
  minFreeHeapBytes: null,
  cpuUsagePercent: null,
  cpuFrequencyMHz: null,
  uptimeSeconds: null,
  wifiRssiDbm: null,
  flashSizeBytes: null,
};

const MAX_TERMINAL_ENTRIES = 40;

function readNumericField(values: Record<string, unknown>, ...keys: string[]) {
  const rawValue = keys.map((key) => values[key]).find((value) => value !== undefined && value !== null);
  if (rawValue === undefined) return null;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function formatBytes(value: number | null) {
  if (value === null) return "--";
  if (value < 1024) return `${Math.round(value)} B`;
  return `${(value / 1024).toFixed(1)} KB`;
}

function formatUptime(value: number | null) {
  if (value === null) return "--";
  const days = Math.floor(value / 86_400);
  const hours = Math.floor((value % 86_400) / 3_600);
  const minutes = Math.floor((value % 3_600) / 60);
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function trendPoints(values: number[]) {
  if (values.length < 2) return "0,26 100,26";
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 30 - ((value - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");
}

export default function DashboardPage() {
  const router = useRouter();
  const clientRef = useRef<MqttClient | null>(null);
  const subscribedTopicRef = useRef<string | null>(null);
  const subscriptionGenerationRef = useRef(0);
  const terminalLogRef = useRef<HTMLDivElement | null>(null);

  const [connection, setConnection] = useState("Connecting");
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [doorState, setDoorState] = useState<DoorState>(null);
  const [rfidValue, setRfidValue] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [temperatureHistory, setTemperatureHistory] = useState<number[]>([]);
  const [humidityHistory, setHumidityHistory] = useState<number[]>([]);
  const [deviceMetrics, setDeviceMetrics] = useState<DeviceMetrics>(EMPTY_METRICS);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([]);

  const appendLog = useCallback((topic: string, payload: string) => {
    const entry: TerminalEntry = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString("id-ID", { hour12: false }),
      topic,
      payload,
    };
    setTerminalEntries((current) => [...current, entry].slice(-MAX_TERMINAL_ENTRIES));
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }

    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const hasSession = Boolean(session);
      setAuthenticated(hasSession);
      setAuthChecked(true);
      if (!hasSession) router.replace("/login");
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      const hasSession = Boolean(session);
      setAuthenticated(hasSession);
      setAuthChecked(true);
      if (!hasSession) router.replace("/login");
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function fetchDevices() {
      if (!authChecked) return;
      setDevicesLoading(true);
      setDeviceError(null);

      if (!authenticated) {
        setDevicesLoading(false);
        return;
      }

      if (!supabase) {
        setDeviceError("Konfigurasi Supabase belum diisi.");
        setDevicesLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("devices")
          .select("id, device_name, device_type, topic_sub, topic_pub");

        if (cancelled) return;
        if (error) {
          setDeviceError(error.message);
          setDevices([]);
        } else {
          const fetchedDevices = (data ?? []) as Device[];
          setDevices(fetchedDevices);
          setSelectedDevice(fetchedDevices[0] ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setDeviceError(error instanceof Error ? error.message : "Gagal memuat perangkat.");
          setDevices([]);
        }
      } finally {
        if (!cancelled) setDevicesLoading(false);
      }
    }

    void fetchDevices();
    return () => {
      cancelled = true;
    };
  }, [authChecked, authenticated]);

  useEffect(() => {
    if (!authChecked || !authenticated) return;

    const host = process.env.NEXT_PUBLIC_EMQX_HOST;
    const username = process.env.NEXT_PUBLIC_EMQX_USERNAME;
    const password = process.env.NEXT_PUBLIC_EMQX_PASSWORD;

    if (!host || !username || !password) {
      setConnection("Missing EMQX configuration");
      appendLog("mqtt", "Konfigurasi broker belum lengkap");
      return;
    }

    const client = mqtt.connect(`wss://${host}:8084/mqtt`, {
      username,
      password,
      clientId: `garage-dashboard-${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 10_000,
      reconnectPeriod: 3_000,
    });
    clientRef.current = client;

    client.on("connect", () => {
      setConnection("Connected");
      subscribedTopicRef.current = null;
      setMqttConnected(true);
      appendLog("mqtt", "Terhubung ke broker MQTT");
    });
    client.on("reconnect", () => {
      setConnection("Reconnecting");
      setMqttConnected(false);
      appendLog("mqtt", "Mencoba menyambungkan ulang...");
    });
    client.on("offline", () => {
      setConnection("Offline");
      setMqttConnected(false);
      appendLog("mqtt", "Koneksi broker offline");
    });
    client.on("close", () => setMqttConnected(false));
    client.on("error", (error) => {
      setConnection("Connection error");
      appendLog("mqtt:error", error.message);
    });
    client.on("message", (topic, message) => {
      const payload = message.toString().trim();
      const normalizedTopic = topic.toLowerCase();
      const suffix = normalizedTopic.split("/").pop() ?? "";
      let values: Record<string, unknown> | null = null;

      try {
        const parsed: unknown = JSON.parse(payload);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          values = parsed as Record<string, unknown>;
        }
      } catch {
        // Plain-text and numeric payloads are handled by their topic suffixes.
      }

      const tempValue = values?.temperature ?? values?.temp ?? values?.suhu;
      const humidityValue = values?.humidity ?? values?.hum ?? values?.kelembapan;
      const numericTemperature = Number(tempValue ?? payload);
      const numericHumidity = Number(humidityValue ?? payload);

      if (tempValue !== undefined || ["suhu", "temperature", "temp"].includes(suffix)) {
        if (Number.isFinite(numericTemperature)) {
          setTemperature(numericTemperature);
          setTemperatureHistory((current) => [...current, numericTemperature].slice(-24));
        }
      }
      if (humidityValue !== undefined || ["kelembapan", "humidity", "hum"].includes(suffix)) {
        if (Number.isFinite(numericHumidity)) {
          setHumidity(numericHumidity);
          setHumidityHistory((current) => [...current, numericHumidity].slice(-24));
        }
      }

      if (values) {
        const freeHeapBytes = readNumericField(values, "free_heap_bytes", "freeHeapBytes", "free_heap");
        const totalHeapBytes = readNumericField(values, "total_heap_bytes", "totalHeapBytes", "total_heap");
        const minFreeHeapBytes = readNumericField(values, "min_free_heap_bytes", "minFreeHeapBytes");
        const cpuUsagePercent = readNumericField(
          values,
          "cpu_usage_percent",
          "cpuUsagePercent",
          "app_loop_load_percent",
          "appLoopLoadPercent",
        );
        const cpuFrequencyMHz = readNumericField(values, "cpu_freq_mhz", "cpuFrequencyMHz", "cpu_freq");
        const uptimeSeconds = readNumericField(values, "uptime_seconds", "uptimeSeconds");
        const wifiRssiDbm = readNumericField(values, "wifi_rssi_dbm", "wifiRssiDbm", "wifi_rssi");
        const flashSizeBytes = readNumericField(values, "flash_size_bytes", "flashSizeBytes");

        if ([freeHeapBytes, totalHeapBytes, minFreeHeapBytes, cpuUsagePercent, cpuFrequencyMHz, uptimeSeconds, wifiRssiDbm, flashSizeBytes].some((value) => value !== null)) {
          setDeviceMetrics((current) => ({
            freeHeapBytes: freeHeapBytes ?? current.freeHeapBytes,
            totalHeapBytes: totalHeapBytes ?? current.totalHeapBytes,
            minFreeHeapBytes: minFreeHeapBytes ?? current.minFreeHeapBytes,
            cpuUsagePercent: cpuUsagePercent ?? current.cpuUsagePercent,
            cpuFrequencyMHz: cpuFrequencyMHz ?? current.cpuFrequencyMHz,
            uptimeSeconds: uptimeSeconds ?? current.uptimeSeconds,
            wifiRssiDbm: wifiRssiDbm ?? current.wifiRssiDbm,
            flashSizeBytes: flashSizeBytes ?? current.flashSizeBytes,
          }));
        }
      }

      if (suffix === "pintu") {
        const stateValue = String(values?.state ?? values?.pintu ?? payload).trim().toUpperCase();
        if (stateValue.includes("OPEN") || stateValue.includes("BUKA") || ["ON", "1", "TRUE"].includes(stateValue)) {
          setDoorState("open");
        } else if (stateValue.includes("CLOSE") || stateValue.includes("TUTUP") || ["OFF", "0", "FALSE"].includes(stateValue)) {
          setDoorState("closed");
        }
      }

      if (suffix === "rfid") {
        const cardValue = values?.uid ?? values?.card_uid ?? values?.cardUid ?? values?.authorized_user ?? values?.user_name ?? values?.user ?? values?.name;
        setRfidValue(String(cardValue ?? payload));
      }

      appendLog(topic, payload || "(empty payload)");
    });

    return () => {
      clientRef.current = null;
      client.end(true);
    };
  }, [authChecked, authenticated, appendLog]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client?.connected) return;

    const nextTopic = selectedDevice?.topic_sub?.trim() || null;
    const previousTopic = subscribedTopicRef.current;
    if (nextTopic === previousTopic) return;
    const generation = ++subscriptionGenerationRef.current;

    setDoorState(null);
    setRfidValue(null);
    setTemperature(null);
    setHumidity(null);
    setTemperatureHistory([]);
    setHumidityHistory([]);
    setDeviceMetrics(EMPTY_METRICS);
    setLastCommand(null);

    const subscribeToSelectedDevice = () => {
      if (generation !== subscriptionGenerationRef.current) return;
      if (!nextTopic) {
        subscribedTopicRef.current = null;
        return;
      }

      client.subscribe(nextTopic, (error) => {
        if (generation !== subscriptionGenerationRef.current) {
          client.unsubscribe(nextTopic);
          return;
        }
        if (error) {
          setConnection("Subscription failed");
          appendLog("mqtt:error", `Gagal subscribe ${nextTopic}: ${error.message}`);
        } else {
          subscribedTopicRef.current = nextTopic;
          appendLog("mqtt", `Subscribe ${nextTopic}`);
        }
      });
    };

    if (previousTopic) {
      client.unsubscribe(previousTopic, (error) => {
        if (generation !== subscriptionGenerationRef.current) return;
        if (error) appendLog("mqtt:error", `Gagal unsubscribe ${previousTopic}`);
        else appendLog("mqtt", `Unsubscribe ${previousTopic}`);
        subscribeToSelectedDevice();
      });
    } else {
      subscribeToSelectedDevice();
    }
  }, [selectedDevice, mqttConnected, appendLog]);

  useEffect(() => {
    const terminal = terminalLogRef.current;
    if (terminal) terminal.scrollTop = terminal.scrollHeight;
  }, [terminalEntries]);

  function publishGateCommand(command: "OPEN" | "CLOSE") {
    const client = clientRef.current;
    const topic = selectedDevice?.topic_pub?.trim();
    if (!client?.connected || !topic) return;

    client.publish(topic, command, { qos: 1 }, (error) => {
      if (error) {
        appendLog("mqtt:error", `Gagal mengirim ${command}: ${error.message}`);
      } else {
        setLastCommand(command);
        appendLog(topic, command);
      }
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
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-6 py-5 text-center shadow-2xl">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
          <p className="text-sm text-slate-300">{supabase ? "Memeriksa sesi login..." : "Konfigurasi Supabase belum tersedia."}</p>
          {!supabase && <a className="mt-3 inline-block text-sm text-cyan-300 hover:text-cyan-200" href="/login">Buka halaman login</a>}
        </div>
      </main>
    );
  }

  const isConnected = connection === "Connected";
  const DoorIcon = doorState === "open" ? DoorOpen : DoorClosed;
  const usedHeapBytes = deviceMetrics.totalHeapBytes !== null && deviceMetrics.freeHeapBytes !== null
    ? Math.max(0, deviceMetrics.totalHeapBytes - deviceMetrics.freeHeapBytes)
    : null;
  const ramUsagePercent = deviceMetrics.totalHeapBytes && usedHeapBytes !== null
    ? Math.min(100, (usedHeapBytes / deviceMetrics.totalHeapBytes) * 100)
    : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111e] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(8,145,178,0.16),transparent_35%),radial-gradient(ellipse_at_bottom_right,rgba(15,23,42,0.75),transparent_45%)]" />

      <header className="relative border-b border-white/10 bg-slate-950/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300 shadow-lg shadow-cyan-950/30 sm:h-12 sm:w-12">
              <DoorOpen size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300 sm:text-xs sm:tracking-[0.24em]">
                JTD · GARAGE IOT
              </p>
              <h1 className="mt-1 text-base font-semibold leading-tight tracking-tight sm:text-xl lg:text-2xl">
                Smart Garage Control Panel
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
            >
              <Home size={15} /> <span className="hidden sm:inline">Beranda</span>
            </Link>
            <Link
              href="/panduan"
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200 sm:px-4 sm:py-2 sm:text-sm"
            >
              Panduan
            </Link>
            <Link
              href="/forum"
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200 sm:px-4 sm:py-2 sm:text-sm"
            >
              Forum
            </Link>
            <div
              className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:px-4 sm:py-2 sm:text-sm ${
                isConnected
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                  : "border-rose-400/20 bg-rose-400/10 text-rose-300"
              }`}
            >
              {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
              MQTT {connection}
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
            >
              <LogOut size={15} /> Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-[0.12em] text-cyan-300 sm:text-sm sm:tracking-normal">SMART ACCESS · REAL-TIME MONITORING</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
              Garasi & pagar pintar
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Pantau status pintu, akses RFID, dan kondisi lingkungan dari satu panel.
            </p>
          </div>

          <div className="w-full lg:max-w-sm">
            <label htmlFor="device-select" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Perangkat aktif
            </label>
            <div className="relative">
              <select
                id="device-select"
                value={selectedDevice ? String(selectedDevice.id) : ""}
                onChange={(event) => {
                  const device = devices.find((item) => String(item.id) === event.target.value);
                  setSelectedDevice(device ?? null);
                }}
                disabled={devicesLoading || devices.length === 0}
                className="w-full appearance-none rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 pr-11 text-sm text-white shadow-inner shadow-black/20 outline-none backdrop-blur-xl transition focus:border-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {devicesLoading && <option value="">Memuat perangkat...</option>}
                {!devicesLoading && devices.length === 0 && <option value="">Tidak ada perangkat</option>}
                {devices.map((device) => (
                  <option key={device.id} value={String(device.id)}>
                    {device.device_name} · {device.device_type}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            </div>
            {deviceError && <p className="mt-2 text-xs text-rose-300">{deviceError}</p>}
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-5" aria-label="Garage status and metrics">
          <article
            className={`relative min-h-56 overflow-hidden rounded-3xl border p-5 shadow-2xl backdrop-blur-xl sm:min-h-64 sm:p-7 ${
              doorState === "open"
                ? "border-amber-300/20 bg-gradient-to-br from-amber-500/15 via-slate-900/90 to-slate-900 shadow-amber-950/20"
                : doorState === "closed"
                  ? "border-emerald-300/20 bg-gradient-to-br from-emerald-500/15 via-slate-900/90 to-slate-900 shadow-emerald-950/20"
                  : "border-slate-700/70 bg-slate-900/70"
            }`}
          >
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/[0.03] blur-2xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">STATUS PINTU GARASI</p>
                <h3 className="mt-5 text-3xl font-bold tracking-wide">
                  {doorState === "open" ? "TERBUKA" : doorState === "closed" ? "TERTUTUP" : "MENUNGGU DATA"}
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  {doorState === "open" ? "Akses garasi sedang terbuka" : doorState === "closed" ? "Garasi terkunci dan tertutup" : "Belum menerima status pintu"}
                </p>
              </div>
              <div className={`rounded-2xl border p-4 ${doorState === "open" ? "border-amber-300/20 bg-amber-300/10 text-amber-200" : doorState === "closed" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-slate-700 bg-slate-800/70 text-slate-300"}`}>
                <DoorIcon size={30} />
              </div>
            </div>
            <div className="relative mt-8 flex items-center gap-2 text-xs text-slate-400">
              <Activity size={15} className={doorState ? "text-cyan-300" : "text-slate-500"} />
              <span>{selectedDevice?.device_name ?? "Pilih perangkat untuk mulai"}</span>
            </div>
          </article>

          <article className="relative min-h-56 overflow-hidden rounded-3xl border border-violet-300/15 bg-gradient-to-br from-violet-500/10 via-slate-900/85 to-slate-900 p-5 shadow-2xl shadow-violet-950/20 backdrop-blur-xl sm:min-h-64 sm:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">AKSES RFID TERAKHIR</p>
                <h3 className="mt-5 break-all text-2xl font-semibold">
                  {rfidValue ?? "Belum ada tap kartu"}
                </h3>
                <p className="mt-2 text-sm text-slate-400">UID kartu atau nama pengguna</p>
              </div>
              <div className="rounded-2xl border border-violet-300/20 bg-violet-300/10 p-4 text-violet-200">
                <KeyRound size={28} />
              </div>
            </div>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/5 px-3 py-1.5 text-xs text-violet-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300" /> RFID access monitor
            </div>
          </article>

          <article className="relative min-h-56 overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-500/10 via-slate-900/85 to-slate-900 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl md:col-span-2 xl:col-span-1 sm:min-h-64 sm:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">LINGKUNGAN GARASI</p>
                <div className="mt-5 flex items-baseline gap-2">
                  <h3 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                    {temperature === null ? "--" : temperature.toFixed(1)}
                  </h3>
                  <span className="text-xl text-slate-400">°C</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">Suhu dalam garasi</p>
              </div>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-cyan-200">
                <Thermometer size={28} />
              </div>
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-4 text-sm">
              <span className="text-slate-400">Kelembapan</span>
              <span className="font-semibold text-cyan-100">{humidity === null ? "--" : `${humidity.toFixed(1)}%`}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Tren suhu</span><span>{temperatureHistory.length} sampel</span>
                </div>
                <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="mt-2 h-9 w-full" role="img" aria-label="Tren suhu terakhir">
                  <polyline points={trendPoints(temperatureHistory)} fill="none" stroke="#67e8f9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Tren kelembapan</span><span>{humidityHistory.length} sampel</span>
                </div>
                <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="mt-2 h-9 w-full" role="img" aria-label="Tren kelembapan terakhir">
                  <polyline points={trendPoints(humidityHistory)} fill="none" stroke="#c4b5fd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-5" aria-label="ESP32 device resource usage">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Performa perangkat</p>
              <h3 className="mt-1 text-lg font-semibold">ESP32 health & resources</h3>
            </div>
            <span className="hidden text-xs text-slate-500 sm:block">Diperbarui lewat MQTT telemetry</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4 shadow-lg shadow-black/10 backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">RAM terpakai</span>
                <HardDrive size={18} className="text-cyan-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold">
                {ramUsagePercent === null ? "--" : `${ramUsagePercent.toFixed(0)}%`}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
                  style={{ width: `${ramUsagePercent ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {formatBytes(usedHeapBytes)} / {formatBytes(deviceMetrics.totalHeapBytes)}
                {deviceMetrics.minFreeHeapBytes !== null && ` · min bebas ${formatBytes(deviceMetrics.minFreeHeapBytes)}`}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4 shadow-lg shadow-black/10 backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">CPU / loop load</span>
                <Cpu size={18} className="text-violet-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold">
                {deviceMetrics.cpuUsagePercent === null ? "--" : `${deviceMetrics.cpuUsagePercent.toFixed(0)}%`}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {deviceMetrics.cpuFrequencyMHz === null ? "Clock -- MHz" : `Clock ${deviceMetrics.cpuFrequencyMHz} MHz`}
                {" · estimasi beban loop"}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4 shadow-lg shadow-black/10 backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Uptime</span>
                <Clock3 size={18} className="text-amber-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold">{formatUptime(deviceMetrics.uptimeSeconds)}</p>
              <p className="mt-2 text-xs text-slate-500">
                {deviceMetrics.uptimeSeconds === null ? "Menunggu telemetry" : `${deviceMetrics.uptimeSeconds.toLocaleString("id-ID")} detik sejak boot`}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4 shadow-lg shadow-black/10 backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Sinyal Wi-Fi</span>
                <Signal size={18} className="text-emerald-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold">
                {deviceMetrics.wifiRssiDbm === null ? "--" : `${deviceMetrics.wifiRssiDbm} dBm`}
              </p>
              <p className="mt-2 text-xs text-slate-500">Kekuatan koneksi ESP32 ke router</p>
            </article>

            <article className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4 shadow-lg shadow-black/10 backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Flash onboard</span>
                <HardDrive size={18} className="text-slate-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold">{formatBytes(deviceMetrics.flashSizeBytes)}</p>
              <p className="mt-2 text-xs text-slate-500">Kapasitas chip flash</p>
            </article>
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[1.1fr_0.9fr] lg:gap-5">
          <article className="min-w-0 rounded-3xl border border-slate-700/70 bg-slate-900/60 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/10 p-2.5 text-cyan-200">
                <Power size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Actuator control</p>
                <h3 className="mt-1 text-xl font-semibold">Kontrol akses gerbang</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Perintah dikirim ke perangkat terpilih melalui MQTT. Status pintu diperbarui saat sensor mengirim topik <code className="text-cyan-200">pintu</code>.
            </p>
            <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => publishGateCommand("OPEN")}
                disabled={!isConnected || !selectedDevice?.topic_pub}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-3 text-xs font-bold tracking-wide text-amber-100 transition hover:border-amber-200/50 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-14 sm:px-5 sm:text-sm"
              >
                <DoorOpen size={18} /> BUKA GARASI
              </button>
              <button
                type="button"
                onClick={() => publishGateCommand("CLOSE")}
                disabled={!isConnected || !selectedDevice?.topic_pub}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-3 text-xs font-bold tracking-wide text-emerald-100 transition hover:border-emerald-200/50 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-14 sm:px-5 sm:text-sm"
              >
                <DoorClosed size={18} /> TUTUP GARASI
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <span className="min-w-0 break-all">Publish topic: <code className="text-slate-300">{selectedDevice?.topic_pub || "—"}</code></span>
              <span className="shrink-0">{lastCommand ? `Perintah terakhir: ${lastCommand}` : "Belum ada perintah dikirim"}</span>
            </div>
          </article>

          <section className="overflow-hidden rounded-3xl border border-slate-700/70 bg-[#050b13]/90 shadow-2xl shadow-black/30 backdrop-blur-xl" aria-label="Real-time MQTT terminal log">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-cyan-300/10 p-2 text-cyan-200"><Terminal size={17} /></div>
                <div>
                  <h3 className="text-sm font-semibold">Live terminal</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">MQTT message stream</p>
                </div>
              </div>
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
            </div>
            <div ref={terminalLogRef} className="h-56 space-y-2 overflow-y-auto p-3 font-mono text-[11px] sm:h-64 sm:p-5 sm:text-xs">
              {terminalEntries.length === 0 ? (
                <p className="text-slate-600">// Menunggu pesan MQTT...</p>
              ) : (
                terminalEntries.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 leading-5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-3">
                    <span className="text-slate-600">{entry.time}</span>
                    <span className="truncate text-cyan-300/80">{entry.topic}</span>
                    <span className="col-start-2 break-all text-slate-300">{entry.payload}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
