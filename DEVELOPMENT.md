# Convention Pengembangan

## Dokumen Teknis Komunikasi ESP32

**1. Command (Web -> ESP32)**

* `swimtimer/cmd/setup` : Mengirim konfigurasi lane yang aktif.
* `swimtimer/cmd/control` : Perintah operasional (`STOP`, `RESET`).

**2. Event (ESP32 -> Web)**

* `swimtimer/evt/start` : Dikirim saat *starter* ditekan (berisi konfirmasi bahwa `millis()` mulai dihitung).
* `swimtimer/evt/lap` : Dikirim saat tombol per lane ditekan (membawa data `lane` dan `elapsed_ms` yang dihitung secara *monotonic* di ESP32).

**3. Telemetry (ESP32 -> Web)**

* `swimtimer/telemetry` : Dikirim berkala (misal setiap 5 detik) berisi `batt_pct`, `rssi`, dan `state` (contoh: `READY`, `RUNNING`, `STOPPED`).
