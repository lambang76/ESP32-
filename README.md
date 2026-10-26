# ESP32 IoT Monitor

ESP32 DHT temperature/humidity reporting and relay control over an EMQX Cloud deployment, with a Next.js dashboard using MQTT over secure WebSockets.

## Firmware

1. Install the ESP32 board package from Arduino IDE **Boards Manager** (Espressif Systems).
2. Install **PubSubClient**, **DHT sensor library** by Adafruit, and **Adafruit Unified Sensor** from **Library Manager**.
3. Open `firmware/arduino/SmartGarageESP32/SmartGarageESP32.ino` in Arduino IDE.
4. Copy `firmware/arduino/SmartGarageESP32/secrets.example.h` to `firmware/arduino/SmartGarageESP32/secrets.h`; fill in Wi-Fi and EMQX credentials. The real `secrets.h` is ignored by Git.
5. Wire DHT11/DHT22 data to GPIO 4 (select `DHT11` or `DHT22` in the sketch), VCC to 3V3, and GND to GND. Wire relay input to GPIO 2 and power its module appropriately.
6. In **Tools**, select your ESP32 board (usually **ESP32 Dev Module**) and its USB port. Confirm the relay module is active-HIGH before connecting a load: GPIO 2 HIGH means ON/OPEN; LOW means OFF/CLOSE.
7. Upload the sketch and open Serial Monitor at 115200 baud.

The firmware publishes readings every five seconds to `jtd/esp32/garasi/suhu` and `jtd/esp32/garasi/kelembapan`, listens on `jtd/esp32/garasi/relay`, and reports health metrics to `jtd/esp32/garasi/metrics`. It connects to EMQX Cloud over MQTT/TLS on port `8883`. The firmware currently uses `setInsecure()` for a prototype; install the EMQX CA certificate and validate TLS before production use.

### Wiring references

- [Wiring diagram](docs/esp32-wiring.svg)
- [Electrical schematic](docs/esp32-schematic.svg)

Pin map: DHT VCC → ESP32 3V3, DHT DATA → GPIO 4, DHT GND → ESP32 GND; relay IN → GPIO 2, relay VCC → a regulated external 5V supply, relay GND → common GND. Use a relay input that accepts 3.3V logic. For a bare DHT22 (not a breakout module), install a 4.7k–10k pull-up between DATA and 3V3. Use the relay's isolated COM/NO contacts only on a low-voltage gate-controller push-button input; do not connect ESP32 GPIO to a gate motor or mains wiring. GPIO 2 is an ESP32 strapping pin, so if the relay module interferes with boot or flashing, move the relay signal to a suitable non-strapping GPIO and change `RELAY_PIN` in the sketch to match.

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

Username sign-in is supported for accounts created after this feature is enabled. Run `web-dashboard/supabase/username_login.sql` in the Supabase SQL Editor. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and Vercel server environment variables; this key must never use the `NEXT_PUBLIC_` prefix or be exposed to browser code. Existing accounts can continue signing in with email; usernames are not automatically assigned to them.

Enable email signups in Supabase **Authentication → Providers → Email**. The `/signup` page creates member accounts; if email confirmation is enabled, members must confirm the message before login. `/forgot-password` sends a recovery email and `/reset-password` accepts the new password. Add the production URL and local URL (`http://localhost:3000/**`) to Supabase **Authentication → URL Configuration → Redirect URLs**; add the Vercel production and preview URL patterns used by this project too.

Run `web-dashboard/supabase/auth_policy.sql` in the Supabase SQL Editor to remove the earlier public read policy and allow signed-in users to read the device list. The dashboard now redirects signed-out visitors to `/login` and provides a logout button.

### Member discussion forum

Run `web-dashboard/supabase/forum.sql` in the Supabase SQL Editor to create the forum post/reply tables and authenticated-only RLS policies. Re-run the script to add the edit/delete policies. The forum is available at `/forum` after login; members can create categorized discussions and reply.

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
| jtd/esp32/garasi/suhu | ESP32 to dashboard | Temperature in Celsius |
| jtd/esp32/garasi/kelembapan | ESP32 to dashboard | Relative humidity percentage |
| jtd/esp32/garasi/metrics | ESP32 to dashboard | JSON device health metrics |
| jtd/esp32/garasi/relay | Dashboard to ESP32 | ON / OPEN or OFF / CLOSE |

The real ESP32 firmware and dummy simulator are separate MQTT clients. Keep npm run simulate:esp32 available for demos; stop it while running the physical ESP32 on the same topics to avoid mixed telemetry.
