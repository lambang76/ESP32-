# ESP32 IoT Monitor

ESP32 DHT temperature/humidity reporting and relay control over an EMQX Cloud deployment, with a Next.js dashboard using MQTT over secure WebSockets.

## Firmware

1. Open `firmware/` with PlatformIO.
2. Set the Wi-Fi and EMQX username/password values in `firmware/src/main.cpp`.
3. Set `DHT_PIN`, `DHT_TYPE`, and `RELAY_PIN` for your wiring.
4. Build and upload to an ESP32.

The firmware publishes readings every five seconds to `esp32/sensor/temperature` and `esp32/sensor/humidity`, and listens on `esp32/actuator/relay`. It connects to the EMQX Cloud deployment over MQTT/TLS on port `8883`. The current firmware uses `setInsecure()` for a quick test; replace it with the deployment CA certificate for production.

## Dashboard

```powershell
cd web-dashboard
npm install
Copy-Item .env.example .env.local
npm run dev
```

Fill in `.env.local` with the EMQX username and password created under **Access Control → Authentication**. Set the same variables in Vercel before deployment. The `NEXT_PUBLIC_` credentials are visible in browser code, so use a dedicated account with only the permissions needed for these topics.

For device selection, also fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The Supabase project needs a `devices` table with `id`, `device_name`, `device_type`, `topic_sub`, and `topic_pub` columns, plus a Row Level Security policy that allows the dashboard to read the intended device rows. Add these variables to Vercel as well.

### Login and device-list access

Enable email signups in Supabase **Authentication → Providers → Email**. The `/signup` page creates member accounts; if email confirmation is enabled, members must confirm the message before login. `/forgot-password` sends a recovery email and `/reset-password` accepts the new password. Add the production URL and local URL (`http://localhost:3000/**`) to Supabase **Authentication → URL Configuration → Redirect URLs**; add the Vercel production and preview URL patterns used by this project too.

Run `web-dashboard/supabase/auth_policy.sql` in the Supabase SQL Editor to remove the earlier public read policy and allow signed-in users to read the device list. The dashboard now redirects signed-out visitors to `/login` and provides a logout button.

### ESP32 health telemetry

The dashboard reads a JSON metrics payload from `jtd/esp32/garasi/metrics`. The firmware and dummy simulator publish free/total/minimum heap, estimated Arduino loop load, CPU clock, uptime, and Wi-Fi RSSI. The displayed loop-load percentage is an estimate of the Arduino application loop's busy time, not a measurement of all ESP32 FreeRTOS tasks.

### Test without an ESP32

Open one terminal in `web-dashboard/` and run `npm run dev` for the dashboard. In a second terminal in the same folder, run:

```powershell
npm run simulate:esp32
```

The simulator connects to your EMQX Cloud deployment over MQTT/TLS on port `8883`, publishes changing dummy temperature and humidity values every five seconds, and prints relay commands sent from the dashboard. Press `Ctrl+C` to stop it.

The dashboard connects to `wss://<your-emqx-host>:8084/mqtt`.

## Topics

| Topic | Direction | Payload |
| --- | --- | --- |
| `esp32/sensor/temperature` | ESP32 → dashboard | Temperature in Celsius |
| `esp32/sensor/humidity` | ESP32 → dashboard | Relative humidity percentage |
| `esp32/actuator/relay` | Dashboard → ESP32 | `ON` or `OFF` |
