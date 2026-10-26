"use client";

import { useEffect, useRef, useState } from "react";
import mqtt, { type MqttClient } from "mqtt";
import { supabase } from "@/lib/supabaseClient";

interface Device {
  id: string | number;
  device_name: string;
  device_type: string;
  topic_sub: string;
  topic_pub: string;
}

export default function DashboardPage() {
  const clientRef = useRef<MqttClient | null>(null);
  const subscribedTopicRef = useRef<string | null>(null);
  const subscriptionGenerationRef = useRef(0);
  const [connection, setConnection] = useState("Connecting");
  const [mqttConnected, setMqttConnected] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [relayOn, setRelayOn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchDevices() {
      setDevicesLoading(true);
      setDeviceError(null);

      if (!supabase) {
        setDeviceError("Missing Supabase configuration");
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
          setDeviceError(error instanceof Error ? error.message : "Could not load devices");
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
      return;
    }

    const client = mqtt.connect(`wss://${host}:8084/mqtt`, {
      username,
      password,
      clientId: `dashboard-${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 10_000,
      reconnectPeriod: 3_000,
    });
    clientRef.current = client;

    client.on("connect", () => {
      setConnection("Connected");
      subscribedTopicRef.current = null;
      setMqttConnected(true);
    });
    client.on("reconnect", () => setConnection("Reconnecting"));
    client.on("offline", () => {
      setConnection("Offline");
      setMqttConnected(false);
    });
    client.on("close", () => setMqttConnected(false));
    client.on("error", () => setConnection("Connection error"));
    client.on("message", (topic, message) => {
      const payload = message.toString();

      try {
        const parsed: unknown = JSON.parse(payload);
        if (parsed && typeof parsed === "object") {
          const values = parsed as Record<string, unknown>;
          const temp = Number(values.temperature ?? values.temp);
          const hum = Number(values.humidity ?? values.hum);
          if (Number.isFinite(temp)) setTemperature(temp);
          if (Number.isFinite(hum)) setHumidity(hum);
          return;
        }
      } catch {
        // Plain numeric sensor payloads are handled below.
      }

      const value = Number(payload);
      if (!Number.isFinite(value)) return;

      const normalizedTopic = topic.toLowerCase();
      if (normalizedTopic.includes("temperature") || normalizedTopic.includes("/temp")) {
        setTemperature(value);
      } else if (normalizedTopic.includes("humidity") || normalizedTopic.includes("/hum")) {
        setHumidity(value);
      } else {
        // A device may publish one numeric reading on its configured topic.
        setTemperature(value);
      }
    });

    return () => {
      clientRef.current = null;
      client.end(true);
    };
  }, []);

  useEffect(() => {
    const client = clientRef.current;
    if (!client?.connected) return;

    const nextTopic = selectedDevice?.topic_sub.trim() || null;
    const previousTopic = subscribedTopicRef.current;
    if (nextTopic === previousTopic) return;
    const generation = ++subscriptionGenerationRef.current;

    setTemperature(null);
    setHumidity(null);
    setRelayOn(false);

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
        } else {
          subscribedTopicRef.current = nextTopic;
        }
      });
    };

    if (previousTopic) {
      client.unsubscribe(previousTopic, (error) => {
        if (generation !== subscriptionGenerationRef.current) return;
        if (error) setConnection("Unsubscribe failed");
        subscribeToSelectedDevice();
      });
    } else {
      subscribeToSelectedDevice();
    }
  }, [selectedDevice, mqttConnected]);

  function toggleRelay() {
    const client = clientRef.current;
    if (!client?.connected || !selectedDevice?.topic_pub.trim()) return;

    const command = relayOn ? "OFF" : "ON";
    client.publish(selectedDevice.topic_pub, command, { qos: 1 }, (error) => {
      if (!error) setRelayOn(command === "ON");
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <section className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            IoT Monitor
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Device dashboard</h1>
          <p className="mt-2 text-sm text-slate-400">
            Broker status: <span className="text-slate-200">{connection}</span>
          </p>
        </header>

        <div className="mb-6">
          <label htmlFor="device-select" className="mb-2 block text-sm text-slate-300">
            Select device
          </label>
          <select
            id="device-select"
            value={selectedDevice ? String(selectedDevice.id) : ""}
            onChange={(event) => {
              const device = devices.find((item) => String(item.id) === event.target.value);
              setSelectedDevice(device ?? null);
            }}
            disabled={devicesLoading || devices.length === 0}
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {devicesLoading && <option value="">Loading devices...</option>}
            {!devicesLoading && devices.length === 0 && (
              <option value="">No devices available</option>
            )}
            {devices.map((device) => (
              <option key={device.id} value={String(device.id)}>
                {device.device_name} ({device.device_type})
              </option>
            ))}
          </select>
          {deviceError && <p className="mt-2 text-sm text-rose-400">{deviceError}</p>}
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <MetricCard label="Temperature" value={temperature?.toFixed(1) ?? "--"} unit="°C" />
          <MetricCard label="Humidity" value={humidity?.toFixed(1) ?? "--"} unit="%" />

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
            <p className="text-sm text-slate-400">Relay</p>
            <p className="mt-4 text-3xl font-semibold">{relayOn ? "ON" : "OFF"}</p>
            <button
              type="button"
              onClick={toggleRelay}
              disabled={connection !== "Connected" || !selectedDevice?.topic_pub}
              className="mt-5 rounded-xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Turn {relayOn ? "off" : "on"}
            </button>
          </article>
        </div>

        <p className="mt-5 text-sm text-slate-500">
          Relay display shows the last command sent. Add a relay state topic if the dashboard
          needs to confirm the physical device state.
        </p>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-4 text-5xl font-semibold">
        {value}<span className="ml-2 text-2xl text-slate-400">{unit}</span>
      </p>
    </article>
  );
}
