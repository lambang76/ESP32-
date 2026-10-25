#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>

// Replace these values before flashing. Do not commit real credentials.
#define WIFI_SSID       "YOUR_WIFI_NAME"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
#define MQTT_HOST       "YOUR_CLUSTER_URL.s1.eu.hivemq.cloud"
#define MQTT_PORT       8883
#define MQTT_USERNAME   "YOUR_HIVEMQ_USERNAME"
#define MQTT_PASSWORD   "YOUR_HIVEMQ_PASSWORD"

#define DHT_PIN         4
#define DHT_TYPE        DHT22 // Change to DHT11 if that is your sensor.
#define RELAY_PIN       2

constexpr unsigned long SENSOR_INTERVAL_MS = 5000;
constexpr unsigned long WIFI_RETRY_MS = 5000;
constexpr unsigned long MQTT_RETRY_MS = 5000;

const char* TEMP_TOPIC = "project/sensor/temperature";
const char* HUMIDITY_TOPIC = "project/sensor/humidity";
const char* RELAY_TOPIC = "project/actuator/relay";

DHT dht(DHT_PIN, DHT_TYPE);
WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);

unsigned long lastSensorReadMs = 0;
unsigned long lastWifiAttemptMs = 0;
unsigned long lastMqttAttemptMs = 0;

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, RELAY_TOPIC) != 0) return;

  String command;
  command.reserve(length);
  for (unsigned int i = 0; i < length; i++) {
    command += static_cast<char>(payload[i]);
  }

  command.trim();
  command.toUpperCase();

  if (command == "ON") {
    digitalWrite(RELAY_PIN, HIGH);
  } else if (command == "OFF") {
    digitalWrite(RELAY_PIN, LOW);
  }
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  const unsigned long now = millis();
  if (now - lastWifiAttemptMs < WIFI_RETRY_MS) return;

  lastWifiAttemptMs = now;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void connectMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqttClient.connected()) return;

  const unsigned long now = millis();
  if (now - lastMqttAttemptMs < MQTT_RETRY_MS) return;

  lastMqttAttemptMs = now;
  const String clientId =
      "esp32-" + String(static_cast<uint32_t>(ESP.getEfuseMac()), HEX);

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

  // Development convenience: skips broker certificate verification.
  // For production, replace with secureClient.setCACert(rootCa).
  secureClient.setInsecure();

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(256);
}

void loop() {
  connectWiFi();
  connectMqtt();
  mqttClient.loop();

  const unsigned long now = millis();
  if (now - lastSensorReadMs < SENSOR_INTERVAL_MS) return;
  lastSensorReadMs = now;

  const float temperature = dht.readTemperature(); // Celsius
  const float humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT read failed");
    return;
  }

  Serial.printf("Temperature: %.1f C, Humidity: %.1f%%\n",
                temperature, humidity);

  if (!mqttClient.connected()) return;

  char tempPayload[16];
  char humidityPayload[16];
  snprintf(tempPayload, sizeof(tempPayload), "%.1f", temperature);
  snprintf(humidityPayload, sizeof(humidityPayload), "%.1f", humidity);

  mqttClient.publish(TEMP_TOPIC, tempPayload);
  mqttClient.publish(HUMIDITY_TOPIC, humidityPayload);
}
