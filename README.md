# ESP32 IoT Monitor

ESP32 DHT temperature/humidity reporting and relay control over HiveMQ Cloud, with a Next.js dashboard using MQTT over secure WebSockets.

## Firmware

1. Open `firmware/` with PlatformIO.
2. Set the Wi-Fi and HiveMQ values in `firmware/src/main.cpp`.
3. Set `DHT_PIN`, `DHT_TYPE`, and `RELAY_PIN` for your wiring.
4. Build and upload to an ESP32.

The firmware publishes readings every five seconds to `project/sensor/temperature` and `project/sensor/humidity`, and listens on `project/actuator/relay`. `WiFiClientSecure::setInsecure()` is enabled as requested; it skips TLS certificate verification and should be replaced with a trusted CA certificate for production.

## Dashboard

```powershell
cd web-dashboard
npm install
Copy-Item .env.example .env.local
npm run dev
```

Fill in `.env.local` with the HiveMQ host and credentials. For Vercel, add the same variables in the project environment settings.

### Test without an ESP32

With `.env.local` filled in, open one terminal in `web-dashboard/` and run `npm run dev` for the dashboard. In a second terminal in the same folder, run:

```powershell
npm run simulate:esp32
```

The simulator connects to HiveMQ over MQTT/TLS, publishes changing dummy temperature and humidity values every five seconds, and prints relay commands sent from the dashboard. Press `Ctrl+C` to stop it.

The browser dashboard connects directly to HiveMQ. Therefore, `NEXT_PUBLIC_` credentials are visible in the browser bundle. Use a dedicated HiveMQ credential with narrowly scoped permissions for the required topics. To keep credentials private, move MQTT access behind a server-side service.

## Topics

| Topic | Direction | Payload |
| --- | --- | --- |
| `project/sensor/temperature` | ESP32 → dashboard | Temperature in Celsius |
| `project/sensor/humidity` | ESP32 → dashboard | Relative humidity percentage |
| `project/actuator/relay` | Dashboard → ESP32 | `ON` or `OFF` |
