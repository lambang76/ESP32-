import { readFileSync } from "node:fs";
import mqtt from "mqtt";

// Load local settings for convenience; shell-provided environment values win.
try {
  const contents = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
} catch {
  // Environment variables may also be supplied by the shell.
}

const host = process.env.NEXT_PUBLIC_EMQX_HOST;
const username = process.env.NEXT_PUBLIC_EMQX_USERNAME;
const password = process.env.NEXT_PUBLIC_EMQX_PASSWORD;

if (!host || !username || !password) {
  console.error("Missing EMQX settings. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

const GARAGE_TOPIC = "jtd/esp32/garasi";
const TEMP_TOPIC = `${GARAGE_TOPIC}/suhu`;
const HUMIDITY_TOPIC = `${GARAGE_TOPIC}/kelembapan`;
const METRICS_TOPIC = `${GARAGE_TOPIC}/metrics`;
const DOOR_TOPIC = `${GARAGE_TOPIC}/pintu`;
const RFID_TOPIC = `${GARAGE_TOPIC}/rfid`;
const RELAY_TOPIC = `${GARAGE_TOPIC}/relay`;

const client = mqtt.connect(`mqtts://${host}:8883`, {
  username,
  password,
  clientId: `esp32-sim-${Math.random().toString(16).slice(2, 10)}`,
  clean: true,
  connectTimeout: 10_000,
  reconnectPeriod: 3_000,
});

let temperature = 25.0;
let humidity = 58.0;
let doorOpen = false;
const simulatorStartedAt = Date.now();

client.on("connect", () => {
  console.log("ESP32 simulator connected to your EMQX Cloud deployment over MQTT/TLS");
  client.subscribe(RELAY_TOPIC, (error) => {
    if (error) console.error("Relay subscribe failed:", error.message);
    else console.log(`Listening for relay commands on ${RELAY_TOPIC}`);
  });
  publishDoorState();
  publishDemoRfid();
});

client.on("reconnect", () => console.log("Reconnecting to EMQX..."));
client.on("error", (error) => console.error("MQTT error:", error.message));
client.on("message", (topic, message) => {
  if (topic === RELAY_TOPIC) {
    const command = message.toString().trim().toUpperCase();
    console.log(`Simulated garage command received: ${command}`);

    if (command === "OPEN" || command === "ON") {
      doorOpen = true;
      publishDoorState();
    } else if (command === "CLOSE" || command === "OFF") {
      doorOpen = false;
      publishDoorState();
    }
  }
});

function publishDoorState() {
  if (!client.connected) return;
  const state = doorOpen ? "TERBUKA" : "TERTUTUP";
  client.publish(DOOR_TOPIC, state);
  console.log(`Published garage door state: ${state}`);
}

function publishDemoRfid() {
  if (!client.connected) return;
  const uid = `JTD-DUMMY-${Math.floor(1000 + Math.random() * 9000)}`;
  client.publish(RFID_TOPIC, uid);
  console.log(`Simulated RFID tap: ${uid}`);
}

function publishReadings() {
  if (!client.connected) return;

  // Small random drift makes the dummy values look like live sensor readings.
  temperature = Math.min(29, Math.max(22, temperature + (Math.random() - 0.5) * 0.6));
  humidity = Math.min(70, Math.max(40, humidity + (Math.random() - 0.5) * 2));

  const tempValue = temperature.toFixed(1);
  const humidityValue = humidity.toFixed(1);

  client.publish(TEMP_TOPIC, tempValue);
  client.publish(HUMIDITY_TOPIC, humidityValue);
  const freeHeapBytes = 182_000 + Math.floor(Math.random() * 12_000);
  const metrics = {
    free_heap_bytes: freeHeapBytes,
    total_heap_bytes: 327_680,
    min_free_heap_bytes: freeHeapBytes - 8_000,
    app_loop_load_percent: Number((4 + Math.random() * 18).toFixed(1)),
    cpu_freq_mhz: 240,
    uptime_seconds: Math.floor((Date.now() - simulatorStartedAt) / 1000),
    wifi_rssi_dbm: -38 - Math.floor(Math.random() * 35),
    flash_size_bytes: 4_194_304,
  };
  client.publish(METRICS_TOPIC, JSON.stringify(metrics));
  console.log(`Published temperature ${tempValue} °C, humidity ${humidityValue}%`);
  console.log(`Published device metrics to ${METRICS_TOPIC}`);
  publishDoorState();
}

publishReadings();
const timer = setInterval(publishReadings, 5000);
const rfidTimer = setInterval(publishDemoRfid, 30_000);

function shutdown() {
  clearInterval(timer);
  clearInterval(rfidTimer);
  client.end(false, () => {
    console.log("ESP32 simulator disconnected");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
