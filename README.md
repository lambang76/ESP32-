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
- [Protoboard/perfboard layout](docs/esp32-protoboard.svg)

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

## Panduan menyusun proposal tugas

Bagian ini bisa dipakai sebagai panduan teman yang menyusun proposal untuk diajukan ke dosen. Sesuaikan format, panjang dokumen, dan aturan sitasi dengan pedoman kampus serta arahan dosen pembimbing. Isi proposal dengan kondisi sistem yang benar-benar sudah dibuat; jangan menuliskan fitur rencana sebagai fitur yang sudah berjalan.

### Usulan judul

**Rancang Bangun Prototipe Smart Garage Berbasis ESP32 dengan Pemantauan dan Kendali Jarak Jauh melalui MQTT**

Judul dapat disesuaikan setelah ruang lingkup disepakati. Jika prototipe hanya diuji memakai simulator, tulis kata *simulasi* atau *prototipe* dengan jelas dan jangan mengklaim pengujian pada gerbang fisik.

### Kerangka proposal

1. **Halaman awal** — sampul sesuai format kampus, identitas anggota kelompok, program studi, dan tahun.
2. **BAB I: Pendahuluan**
   - Latar belakang: kebutuhan memantau kondisi garasi/gerbang dan contoh manfaat IoT.
   - Identifikasi dan rumusan masalah: bagaimana mengirim data sensor ke dashboard dan mengendalikan relay melalui jaringan internet.
   - Batasan masalah: jelaskan sensor, aktuator, broker, dashboard, dan jenis pengujian yang benar-benar digunakan.
   - Tujuan, manfaat, serta sistematika penulisan.
3. **BAB II: Tinjauan Pustaka** — ringkas dan sitasikan sumber tepercaya tentang ESP32, sensor DHT, relay, MQTT, EMQX, Next.js, Supabase, serta sistem serupa. Bandingkan karya terdahulu dan jelaskan celah yang ingin dijawab.
4. **BAB III: Metodologi dan Perancangan**
   - Metode pengembangan dan tahapan kerja.
   - Diagram blok dan arsitektur: ESP32/simulator ↔ EMQX ↔ dashboard; Supabase dipakai untuk autentikasi dan daftar perangkat.
   - Diagram alir firmware dan dashboard, rancangan topik/payload MQTT, serta rancangan rangkaian.
   - Perangkat dan perangkat lunak yang diperlukan.
   - Rencana pengujian beserta indikator keberhasilan.
5. **Jadwal dan anggaran** — tabel kegiatan per minggu dan estimasi komponen berdasarkan harga/sumber yang dicatat saat proposal dibuat. Tandai komponen yang belum tersedia sebagai rencana.
6. **Daftar pustaka** — gunakan gaya sitasi yang diminta dosen; setiap teori, gambar, dan data dari sumber lain harus dirujuk.
7. **Lampiran** — diagram rangkaian, daftar pin, contoh payload/topik, serta foto atau tangkapan layar hasil yang sudah ada.

### Fakta proyek yang bisa dipakai

- Firmware Arduino ESP32 membaca suhu dan kelembapan dari DHT11/DHT22 setiap lima detik.
- Firmware mengirim data ke topik `jtd/esp32/garasi/suhu` dan `jtd/esp32/garasi/kelembapan`, menerima perintah relay melalui `jtd/esp32/garasi/relay`, dan mengirim telemetri perangkat ke `jtd/esp32/garasi/metrics`.
- Dashboard Next.js menerima data MQTT melalui WebSocket TLS. EMQX Cloud menjadi broker; Supabase menyediakan autentikasi dan daftar perangkat.
- Simulator dummy dapat dipakai untuk demonstrasi alur dashboard tanpa papan ESP32 fisik. Bedakan hasil simulator dari hasil uji perangkat nyata.
- Pengukuran CPU yang ditampilkan adalah estimasi beban loop aplikasi, bukan pemakaian CPU total ESP32.
- Pada firmware saat ini belum ada pembaca RFID atau sensor posisi pintu. Status gerbang fisik tidak boleh diklaim terdeteksi otomatis tanpa sensor tambahan dan implementasinya.
- Relay GPIO 2 hanya mengendalikan masukan relay. Untuk integrasi gerbang nyata, gunakan masukan tombol bertegangan rendah dari controller gerbang yang kompatibel; jangan hubungkan ESP32 langsung ke motor atau tegangan PLN.

### Rencana pengujian yang disarankan

Cantumkan langkah uji, hasil yang diharapkan, hasil aktual, dan bukti. Contoh: koneksi Wi-Fi dan broker; pembaruan suhu/kelembapan tiap lima detik; status koneksi saat jaringan terputus dan pulih; perintah ON/OFF pada simulator; login dan pemilihan perangkat; serta uji ESP32 fisik jika perangkat tersedia. Untuk nilai ambang keberhasilan (misalnya keberhasilan pesan atau waktu respons), sepakati metodenya dengan dosen dan ukur—jangan mengarang angka hasil.

### Checklist sebelum diajukan

- Konfirmasi judul, format, metode, ruang lingkup, serta jadwal dengan dosen.
- Pastikan proposal menyebut simulator atau perangkat fisik secara akurat.
- Cocokkan diagram, nama pin, topik MQTT, dan uraian dengan firmware/dashboard di repositori ini.
- Cari sumber primer/resmi untuk spesifikasi teknis; tulis sitasi dan daftar pustaka secara konsisten.
- Minta semua anggota memeriksa isi, pembagian tugas, dan anggaran sebelum dokumen diajukan.
