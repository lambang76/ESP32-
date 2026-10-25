"use client";

import { useEffect, useRef, useState } from "react";
import mqtt, { type MqttClient } from "mqtt";

const TEMP_TOPIC = "project/sensor/temperature";
const HUMIDITY_TOPIC = "project/sensor/humidity";
const RELAY_TOPIC = "project/actuator/relay";

export default function DashboardPage() {
  const clientRef = useRef<MqttClient | null>(null);
  const [connection, setConnection] = useState("Connecting");
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [relayOn, setRelayOn] = useState(false);

  useEffect(() => {
    const host = process.env.NEXT_PUBLIC_HIVEMQ_HOST;
    const username = process.env.NEXT_PUBLIC_HIVEMQ_USERNAME;
    const password = process.env.NEXT_PUBLIC_HIVEMQ_PASSWORD;

    if (!host || !username || !password) {
      setConnection("Missing MQTT configuration");
      return;
    }

    const client = mqtt.connect(`wss://${host}:8884/mqtt`, {
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
      client.subscribe([TEMP_TOPIC, HUMIDITY_TOPIC], (error) => {
        if (error) setConnection("Subscription failed");
      });
    });
    client.on("reconnect", () => setConnection("Reconnecting"));
    client.on("offline", () => setConnection("Offline"));
    client.on("error", () => setConnection("Connection error"));
    client.on("message", (topic, message) => {
      const value = Number(message.toString());
      if (!Number.isFinite(value)) return;
      if (topic === TEMP_TOPIC) setTemperature(value);
      if (topic === HUMIDITY_TOPIC) setHumidity(value);
    });

    return () => {
      clientRef.current = null;
      client.end(true);
    };
  }, []);

  function toggleRelay() {
    const client = clientRef.current;
    if (!client?.connected) return;

    const command = relayOn ? "OFF" : "ON";
    client.publish(RELAY_TOPIC, command, { qos: 1 }, (error) => {
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

        <div className="grid gap-5 sm:grid-cols-3">
          <MetricCard label="Temperature" value={temperature?.toFixed(1) ?? "--"} unit="°C" />
          <MetricCard label="Humidity" value={humidity?.toFixed(1) ?? "--"} unit="%" />

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
            <p className="text-sm text-slate-400">Relay</p>
            <p className="mt-4 text-3xl font-semibold">{relayOn ? "ON" : "OFF"}</p>
            <button
              type="button"
              onClick={toggleRelay}
              disabled={connection !== "Connected"}
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
