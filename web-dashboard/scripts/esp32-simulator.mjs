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

const TEMP_TOPIC = "esp32/sensor/temperature";
const HUMIDITY_TOPIC = "esp32/sensor/humidity";
const RELAY_TOPIC = "esp32/actuator/relay";

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

client.on("connect", () => {
  console.log("ESP32 simulator connected to your EMQX Cloud deployment over MQTT/TLS");
  client.subscribe(RELAY_TOPIC, (error) => {
    if (error) console.error("Relay subscribe failed:", error.message);
    else console.log(`Listening for relay commands on ${RELAY_TOPIC}`);
  });
});

client.on("reconnect", () => console.log("Reconnecting to EMQX..."));
client.on("error", (error) => console.error("MQTT error:", error.message));
client.on("message", (topic, message) => {
  if (topic === RELAY_TOPIC) {
    console.log(`Simulated relay received: ${message.toString()}`);
  }
});

function publishReadings() {
  if (!client.connected) return;

  // Small random drift makes the dummy values look like live sensor readings.
  temperature = Math.min(29, Math.max(22, temperature + (Math.random() - 0.5) * 0.6));
  humidity = Math.min(70, Math.max(40, humidity + (Math.random() - 0.5) * 2));

  const tempValue = temperature.toFixed(1);
  const humidityValue = humidity.toFixed(1);

  client.publish(TEMP_TOPIC, tempValue);
  client.publish(HUMIDITY_TOPIC, humidityValue);
  console.log(`Published temperature ${tempValue} °C, humidity ${humidityValue}%`);
}

publishReadings();
const timer = setInterval(publishReadings, 5000);

function shutdown() {
  clearInterval(timer);
  client.end(false, () => {
    console.log("ESP32 simulator disconnected");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
