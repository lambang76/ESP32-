#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <WebServer.h>
#include "secrets.h" // Copy secrets.example.h and add your credentials.

#define DHT_PIN 4
#define DHT_TYPE DHT22 // Change to DHT11 if that is the sensor you have.
#define RELAY_PIN 2

constexpr unsigned long SENSOR_INTERVAL_MS = 5000;
constexpr unsigned long METRICS_INTERVAL_MS = 5000;
constexpr unsigned long WIFI_RETRY_MS = 5000;
constexpr unsigned long MQTT_RETRY_MS = 5000;

const char* TEMP_TOPIC = "jtd/esp32/garasi/suhu";
const char* HUMIDITY_TOPIC = "jtd/esp32/garasi/kelembapan";
const char* METRICS_TOPIC = "jtd/esp32/garasi/metrics";
const char* RELAY_TOPIC = "jtd/esp32/garasi/relay";

DHT dht(DHT_PIN, DHT_TYPE);
WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);
WebServer localServer(80);

float latestTemperature = NAN;
float latestHumidity = NAN;
bool relayIsOn = false;

const char LOCAL_DASHBOARD_HTML[] PROGMEM = R"HTML(
<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#07111e"><title>Smart Garage - Local</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at top left,#0e749044,transparent 38%),#07111e;color:#e5eefb;font:16px system-ui,sans-serif;padding:24px}.wrap{max-width:760px;margin:auto}.tag{color:#67e8f9;font-size:12px;font-weight:800;letter-spacing:.18em}.muted{color:#94a3b8}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin:24px 0}.card{border:1px solid #26354b;border-radius:20px;background:#101b2d;padding:22px}.label{color:#94a3b8;font-size:14px}.value{font-size:36px;font-weight:750;margin-top:12px}.unit{font-size:18px;color:#94a3b8}.state{color:#67e8f9}.buttons{display:flex;gap:10px;margin-top:18px}button{border:0;border-radius:12px;padding:13px 20px;font-weight:750;font-size:15px;cursor:pointer;background:#22d3ee;color:#07111e}button.secondary{background:#26354b;color:#e5eefb}.status{border-radius:12px;padding:12px;background:#0b1422;color:#94a3b8;font-size:13px}.foot{font-size:12px;color:#64748b;line-height:1.6;margin-top:20px}@media(max-width:480px){body{padding:16px}.value{font-size:30px}}
</style></head><body><main class="wrap"><p class="tag">SMART GARAGE · LOCAL BACKUP</p><h1>Monitoring lokal ESP32</h1><p class="muted">Halaman ini disajikan langsung oleh ESP32. Tetap dapat dipakai saat EMQX atau website cloud tidak tersedia, selama perangkat dan jaringan lokal aktif.</p>
<div class="grid"><section class="card"><div class="label">Suhu</div><div class="value"><span id="temp">--</span> <span class="unit">°C</span></div></section><section class="card"><div class="label">Kelembapan</div><div class="value"><span id="humidity">--</span> <span class="unit">%</span></div></section><section class="card"><div class="label">Relay</div><div class="value state" id="relay">--</div><div class="buttons"><button onclick="command('ON')">Nyalakan</button><button class="secondary" onclick="command('OFF')">Matikan</button></div></section></div>
<p class="status" id="status">Menghubungkan ke ESP32...</p><p class="foot">Akses dari jaringan lokal melalui alamat IP ESP32. Untuk akses dari luar rumah, gunakan VPN pada router. Jangan membuka port HTTP ESP32 langsung ke internet.</p></main>
<script>
async function refresh(){try{const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();document.querySelector('#temp').textContent=d.temperature??'--';document.querySelector('#humidity').textContent=d.humidity??'--';document.querySelector('#relay').textContent=d.relay;document.querySelector('#status').textContent='Wi-Fi '+d.wifi+' · MQTT '+d.mqtt+' · diperbarui '+new Date().toLocaleTimeString('id-ID')}catch(e){document.querySelector('#status').textContent='ESP32 tidak dapat dijangkau: '+e.message}}
async function command(value){try{const r=await fetch('/api/relay',{method:'POST',headers:{'Content-Type':'text/plain'},body:value});if(!r.ok)throw Error(await r.text());await refresh()}catch(e){alert('Perintah gagal: '+e.message)}}refresh();setInterval(refresh,3000);
</script></body></html>
)HTML";

unsigned long lastSensorReadMs = 0;
unsigned long lastMetricsReadMs = 0;
unsigned long lastWifiAttemptMs = 0;
unsigned long lastMqttAttemptMs = 0;
unsigned long cpuWindowStartedMs = 0;
uint64_t appLoopBusyUs = 0;

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, RELAY_TOPIC) != 0) return;

  String command;
  command.reserve(length);
  for (unsigned int i = 0; i < length; i++) {
    command += static_cast<char>(payload[i]);
  }

  command.trim();
  command.toUpperCase();

  // This sketch assumes an active-HIGH relay module.
  if (command == "ON" || command == "OPEN") {
    relayIsOn = true;
    digitalWrite(RELAY_PIN, HIGH);
  } else if (command == "OFF" || command == "CLOSE") {
    relayIsOn = false;
    digitalWrite(RELAY_PIN, LOW);
  }
}

void configureLocalDashboard() {
  localServer.on("/", HTTP_GET, []() {
    localServer.send_P(200, "text/html; charset=utf-8", LOCAL_DASHBOARD_HTML);
  });

  localServer.on("/api/status", HTTP_GET, []() {
    String body = "{\"temperature\":";
    body += isnan(latestTemperature) ? "null" : String(latestTemperature, 1);
    body += ",\"humidity\":";
    body += isnan(latestHumidity) ? "null" : String(latestHumidity, 1);
    body += ",\"relay\":\"";
    body += relayIsOn ? "ON" : "OFF";
    body += "\",\"wifi\":\"connected\",\"mqtt\":\"";
    body += mqttClient.connected() ? "connected" : "offline";
    body += "\"}";
    localServer.send(200, "application/json", body);
  });

  localServer.on("/api/relay", HTTP_POST, []() {
    String command = localServer.arg("plain");
    command.trim();
    command.toUpperCase();
    if (command == "ON") {
      relayIsOn = true;
      digitalWrite(RELAY_PIN, HIGH);
    } else if (command == "OFF") {
      relayIsOn = false;
      digitalWrite(RELAY_PIN, LOW);
    } else {
      localServer.send(400, "text/plain", "Expected ON or OFF");
      return;
    }
    localServer.send(200, "application/json", relayIsOn ? "{\"relay\":\"ON\"}" : "{\"relay\":\"OFF\"}");
  });

  localServer.begin();
  Serial.println("Local backup dashboard started on port 80");
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  const unsigned long now = millis();
  if (now - lastWifiAttemptMs < WIFI_RETRY_MS) return;

  lastWifiAttemptMs = now;
  Serial.printf("Connecting to Wi-Fi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void connectMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqttClient.connected()) return;

  const unsigned long now = millis();
  if (now - lastMqttAttemptMs < MQTT_RETRY_MS) return;

  lastMqttAttemptMs = now;
  const String clientId = "esp32-" + String(static_cast<uint32_t>(ESP.getEfuseMac()), HEX);

  Serial.printf("Connecting to MQTT host: %s\n", MQTT_HOST);
  if (mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
    mqttClient.subscribe(RELAY_TOPIC);
    Serial.println("MQTT connected; subscribed to relay topic");
  } else {
    Serial.printf("MQTT connect failed, state=%d\n", mqttClient.state());
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);

  dht.begin();
  WiFi.mode(WIFI_STA);
  cpuWindowStartedMs = millis();

  // Prototype setting only. For production use, validate the EMQX CA certificate.
  secureClient.setInsecure();

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(512);
  mqttClient.setSocketTimeout(2);

  configureLocalDashboard();

  Serial.println("Smart Garage ESP32 starting");
}

void loop() {
  const uint32_t loopStartedUs = micros();
  static bool localAddressReported = false;
  connectWiFi();
  if (WiFi.status() == WL_CONNECTED && !localAddressReported) {
    Serial.printf("Local backup dashboard: http://%s/\n", WiFi.localIP().toString().c_str());
    localAddressReported = true;
  } else if (WiFi.status() != WL_CONNECTED) {
    localAddressReported = false;
  }
  connectMqtt();
  mqttClient.loop();
  localServer.handleClient();

  const unsigned long now = millis();
  if (now - lastSensorReadMs >= SENSOR_INTERVAL_MS) {
    lastSensorReadMs = now;

    const float temperature = dht.readTemperature();
    const float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("DHT read failed; check sensor wiring and DHT_TYPE");
    } else {
      latestTemperature = temperature;
      latestHumidity = humidity;
      Serial.printf("Temperature: %.1f C, humidity: %.1f%%\n", temperature, humidity);

      if (mqttClient.connected()) {
        char tempPayload[16];
        char humidityPayload[16];
        snprintf(tempPayload, sizeof(tempPayload), "%.1f", temperature);
        snprintf(humidityPayload, sizeof(humidityPayload), "%.1f", humidity);
        mqttClient.publish(TEMP_TOPIC, tempPayload);
        mqttClient.publish(HUMIDITY_TOPIC, humidityPayload);
      }
    }
  }

  if (now - lastMetricsReadMs >= METRICS_INTERVAL_MS) {
    lastMetricsReadMs = now;
    const unsigned long windowMs = now - cpuWindowStartedMs;
    float appLoopLoadPercent = windowMs > 0
      ? (static_cast<float>(appLoopBusyUs) / (windowMs * 1000.0f)) * 100.0f
      : 0.0f;
    if (appLoopLoadPercent > 100.0f) appLoopLoadPercent = 100.0f;
    appLoopBusyUs = 0;
    cpuWindowStartedMs = now;

    if (mqttClient.connected()) {
      char metricsPayload[320];
      snprintf(
        metricsPayload,
        sizeof(metricsPayload),
        "{\"free_heap_bytes\":%u,\"total_heap_bytes\":%u,\"min_free_heap_bytes\":%u,\"app_loop_load_percent\":%.1f,\"cpu_freq_mhz\":%u,\"uptime_seconds\":%lu,\"wifi_rssi_dbm\":%d,\"flash_size_bytes\":%u}",
        static_cast<unsigned int>(ESP.getFreeHeap()),
        static_cast<unsigned int>(ESP.getHeapSize()),
        static_cast<unsigned int>(ESP.getMinFreeHeap()),
        appLoopLoadPercent,
        static_cast<unsigned int>(ESP.getCpuFreqMHz()),
        static_cast<unsigned long>(now / 1000UL),
        static_cast<int>(WiFi.RSSI()),
        static_cast<unsigned int>(ESP.getFlashChipSize())
      );
      mqttClient.publish(METRICS_TOPIC, metricsPayload);
    }
  }

  appLoopBusyUs += static_cast<uint32_t>(micros() - loopStartedUs);
  delay(1);
}
