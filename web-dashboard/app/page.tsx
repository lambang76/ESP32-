"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mqtt, { type MqttClient } from "mqtt";
import {
  Activity,
  ChevronDown,
  DoorClosed,
  DoorOpen,
  KeyRound,
  Power,
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

const MAX_TERMINAL_ENTRIES = 40;

export default function DashboardPage() {
  const clientRef = useRef<MqttClient | null>(null);
  const subscribedTopicRef = useRef<string | null>(null);
  const subscriptionGenerationRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const [connection, setConnection] = useState("Connecting");
  const [mqttConnected, setMqttConnected] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [doorState, setDoorState] = useState<DoorState>(null);
  const [rfidValue, setRfidValue] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
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
    let cancelled = false;

    async function fetchDevices() {
      setDevicesLoading(true);
      setDeviceError(null);

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
  }, []);

  useEffect(() => {
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
        if (Number.isFinite(numericTemperature)) setTemperature(numericTemperature);
      }
      if (humidityValue !== undefined || ["kelembapan", "humidity", "hum"].includes(suffix)) {
        if (Number.isFinite(numericHumidity)) setHumidity(numericHumidity);
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
  }, [appendLog]);

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
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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

  const isConnected = connection === "Connected";
  const DoorIcon = doorState === "open" ? DoorOpen : DoorClosed;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111e] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(8,145,178,0.16),transparent_35%),radial-gradient(ellipse_at_bottom_right,rgba(15,23,42,0.75),transparent_45%)]" />

      <header className="relative border-b border-white/10 bg-slate-950/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-300 shadow-lg shadow-cyan-950/30">
              <DoorOpen size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                JTD · GARAGE IOT
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                Smart Garage Control Panel
              </h1>
            </div>
          </div>

          <div
            className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${
              isConnected
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                : "border-rose-400/20 bg-rose-400/10 text-rose-300"
            }`}
          >
            {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
            MQTT {connection}
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-300">SMART ACCESS · REAL-TIME MONITORING</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
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

        <section className="grid gap-5 lg:grid-cols-3" aria-label="Garage status and metrics">
          <article
            className={`relative min-h-64 overflow-hidden rounded-3xl border p-6 shadow-2xl backdrop-blur-xl sm:p-7 ${
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

          <article className="relative min-h-64 overflow-hidden rounded-3xl border border-violet-300/15 bg-gradient-to-br from-violet-500/10 via-slate-900/85 to-slate-900 p-6 shadow-2xl shadow-violet-950/20 backdrop-blur-xl sm:p-7">
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

          <article className="relative min-h-64 overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-500/10 via-slate-900/85 to-slate-900 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">LINGKUNGAN GARASI</p>
                <div className="mt-5 flex items-baseline gap-2">
                  <h3 className="text-5xl font-semibold tracking-tight">
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
          </article>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-slate-700/70 bg-slate-900/60 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
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
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => publishGateCommand("OPEN")}
                disabled={!isConnected || !selectedDevice?.topic_pub}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-400/10 px-5 py-3 text-sm font-bold tracking-wide text-amber-100 transition hover:border-amber-200/50 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <DoorOpen size={18} /> BUKA GARASI
              </button>
              <button
                type="button"
                onClick={() => publishGateCommand("CLOSE")}
                disabled={!isConnected || !selectedDevice?.topic_pub}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-5 py-3 text-sm font-bold tracking-wide text-emerald-100 transition hover:border-emerald-200/50 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <DoorClosed size={18} /> TUTUP GARASI
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Publish topic: <code className="text-slate-300">{selectedDevice?.topic_pub || "—"}</code></span>
              <span>{lastCommand ? `Perintah terakhir: ${lastCommand}` : "Belum ada perintah dikirim"}</span>
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
            <div className="h-64 space-y-2 overflow-y-auto p-4 font-mono text-xs sm:p-5">
              {terminalEntries.length === 0 ? (
                <p className="text-slate-600">// Menunggu pesan MQTT...</p>
              ) : (
                terminalEntries.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 leading-5 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                    <span className="text-slate-600">{entry.time}</span>
                    <span className="truncate text-cyan-300/80">{entry.topic}</span>
                    <span className="col-start-2 break-all text-slate-300">{entry.payload}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
