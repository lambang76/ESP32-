#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>
#include "secrets.h" // Copy secrets.example.h to secrets.h and add your credentials.

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
    digitalWrite(RELAY_PIN, HIGH);
  } else if (command == "OFF" || command == "CLOSE") {
    digitalWrite(RELAY_PIN, LOW);
  }
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

  Serial.println("Smart Garage ESP32 starting");
}

void loop() {
  const uint32_t loopStartedUs = micros();
  connectWiFi();
  connectMqtt();
  mqttClient.loop();

  const unsigned long now = millis();
  if (now - lastSensorReadMs >= SENSOR_INTERVAL_MS) {
    lastSensorReadMs = now;

    const float temperature = dht.readTemperature();
    const float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("DHT read failed; check sensor wiring and DHT_TYPE");
    } else {
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

