# ESP32 IoT Monitor

ESP32 DHT temperature/humidity reporting and relay control over the EMQX public MQTT broker, with a Next.js dashboard using MQTT over secure WebSockets.

## Firmware

1. Open `firmware/` with PlatformIO.
2. Set your Wi-Fi values in `firmware/src/main.cpp`.
3. Set `DHT_PIN`, `DHT_TYPE`, and `RELAY_PIN` for your wiring.
4. Build and upload to an ESP32.

The firmware publishes readings every five seconds to `rizki/jtd/esp32/sensor/temperature` and `rizki/jtd/esp32/sensor/humidity`, and listens on `rizki/jtd/esp32/actuator/relay`. It uses the public broker at `broker.emqx.io:1883` without authentication or TLS.

## Dashboard

```powershell
cd web-dashboard
npm install
npm run dev
```

### Test without an ESP32

Open one terminal in `web-dashboard/` and run `npm run dev` for the dashboard. In a second terminal in the same folder, run:

```powershell
npm run simulate:esp32
```

The simulator connects to EMQX at `broker.emqx.io:1883`, publishes changing dummy temperature and humidity values every five seconds, and prints relay commands sent from the dashboard. Press `Ctrl+C` to stop it.

The dashboard connects to `wss://broker.emqx.io:8084/mqtt`. EMQX's public broker has no authentication: anyone can publish to or subscribe to these topics. Use it for demos only, avoid sending private data, and choose a unique topic prefix if you want to reduce accidental collisions.

## Topics

| Topic | Direction | Payload |
| --- | --- | --- |
| `rizki/jtd/esp32/sensor/temperature` | ESP32 → dashboard | Temperature in Celsius |
| `rizki/jtd/esp32/sensor/humidity` | ESP32 → dashboard | Relative humidity percentage |
| `rizki/jtd/esp32/actuator/relay` | Dashboard → ESP32 | `ON` or `OFF` |
