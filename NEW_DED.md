# DETAILED ENGINEERING DESIGN (DED) SISTEM TIMING RENANG "RUCIKA" (REV 4.0)

## I. SPESIFIKASI SISTEM
*   **Arsitektur Jaringan:** Wired RS485 Multi-Drop (1 Master, 8 Slave).
*   **Kapasitas:** 32 Lane Total (16 Lane Sisi A / Start, 16 Lane Sisi B / Finish).
*   **Pembagian Node:** 1 Master di ruang kontrol, 4 Slave di Sisi A, 4 Slave di Sisi B. (1 Slave = 4 Lane = 8 Tombol).
*   **Protokol Komunikasi:** *High-Speed Polling* (Anti-collision).
*   **Sinkronisasi Waktu:** *Software-based broadcast* (1 detik) dengan kompensasi *hardware drift*.
*   **Keandalan Sistem:** *Hardware Watchdog Timer* (WDT), ISR *Debounce*, MQTT QoS 1 via ***AsyncMqttClient*** + *Local Queue*.
*   **Keamanan:** Isolasi Optocoupler, Konektor SP21 Plastik IP68, Data-Only Type-C.

---

## II. DAFTAR MATERIAL (BILL OF MATERIALS)

### A. Unit Master Timing (1 Unit)
*   **Otak Sistem:** 1x ESP32 Wroom 32 (30 Pin).
*   **Jaringan:** 1x Modul W5500 (Ethernet LAN).
*   **Audio:** 1x Modul JQ6500 (MP3 Player), 1x Audio Isolation Transformer 1:1 600 Ohm, 1x Soket Akai Female Mono 6.5mm.
*   **Power Supply:** 1x PSU 24V DC, 1x LM2596 (Step-down), 1x LM7805 (Regulator 5V).
*   **Filter Daya:** 1x Elco 470uF, 1x Elco 47uF, 1x Kapasitor Keramik 104.
*   **Tombol Start:** 1x PC817 (Optocoupler), 1x Resistor 2.2kΩ (1/2W), 1x Resistor 4.7kΩ (1/4W).
*   **Komunikasi:** 1x Modul **XY-K485** (Auto-Direction), 1x Resistor 120 Ohm + Jumper Cap (Terminasi).
*   **Maintenance:** 1x LED WS2812B (GPIO 13), 1x Konektor Data-Only Type-C (VBUS dipotong).
*   **Konektor Keluar:** 1x **SP21 4-Pin Female (Plastik IP68)**.

### B. Unit Slave (8 Unit - per unitnya)
*   **Otak Sistem:** 1x ESP32 Wroom 32.
*   **Power Supply:** 1x LM2596 (Step-down 24V ke 5V).
*   **Filter Daya:** 1x Elco 1000uF/16V, 1x Kapasitor Keramik 104.
*   **Komunikasi:** 1x Modul **XY-K485** (Auto-Direction), 1x Resistor 120 Ohm + Jumper Cap (Terminasi).
*   **Isolasi Tombol:** 2x Modul Optocoupler 4-Channel (Total 8 channel, disuplai 24V).
*   **Addressing:** 1x DIP Switch 4-Pin (Setting ID Slave 1-8).
*   **Maintenance:** 1x LED WS2812B (GPIO 13), 1x Konektor Data-Only Type-C (VBUS dipotong).
*   **Konektor Bus (In/Out):** 2x **SP21 4-Pin Male (Plastik IP68)**.
*   **Konektor Tombol:** 8x Konektor GX12 4-Pin (4 perenang, 4 manusia).

### C. Kabel & Interkoneksi
*   **Kabel Bus Utama:** **Kabel Cat6 FTP** (Foiled Twisted Pair) 4 pasang + *drain wire*.
*   **Kabel Tombol:** Kabel 2 konduktor yang di-*twist* dari GX12 ke tombol di kolam.

---

## III. SKEMA WIRING & KONEKTOR

### A. Mapping Kabel Cat6 ke SP21 4-Pin (Mitigasi Voltage Drop)
Untuk mencegah *brownout* di ujung kolam, kawat di dalam Cat6 digabungkan (paralel):
*   **Pin 1 (RS485 A):** Kawat Biru (Pair 1).
*   **Pin 2 (RS485 B):** Kawat Putih-Biru (Pair 1).
*   **Pin 3 (+24V DC):** Kawat Oranye **digabung** dengan Putih-Oranye (Pair 2).
*   **Pin 4 (GND):** Kawat Coklat **digabung** dengan Putih-Coklat (Pair 3).
*   **Drain Wire (Shield):** Hanya disambungkan ke *Earth/Ground* di sisi **Master**. Di sisi Slave dibiarkan menggantung.
*   *(Kawat Hijau & Putih-Hijau tidak dipakai).*

### B. Fitur Maintenance
*   **Data-Only Type-C:** Jalur VBUS (5V) dipotong fisik. Hanya GND, D+, dan D- yang tersambung. Aman untuk *live-debugging* tanpa risiko laptop tersengat atau *backflow*.
*   **LED WS2812B:** Indikator visual bagi panitia:
    *   *Merah berkedip:* Booting / RS485 terputus.
    *   *Kuning:* RS485 tersambung, menunggu sinkronisasi.
    *   *Hijau:* Tersinkronisasi, siap tempur.
    *   *Biru kilat:* Tombol ditekan / data terkirim.

---

## IV. ARSITEKTUR PERANGKAT LUNAK & PROTOKOL

### A. High-Speed Polling (Anti-Collision)
Master memanggil Slave secara bergantian (jeda ~2ms per Slave).
*   **Request (Master):** `REQ:<ID_Slave>\n`
*   **Response (Slave):** `DATA:<Lane>:<Tipe>:<Waktu>\n` (Jika ada event) ATAU `NODATA\n` (Jika kosong).
*   **Kalkulasi:** Siklus 8 Slave memakan waktu ~16ms. Karena waktu dicatat di level *interrupt* Slave, latensi polling tidak mempengaruhi akurasi milidetik.

### B. Sinkronisasi Waktu (Anti-Drift)
*   Master mem-*broadcast* `SYNC:<master_millis>\n` setiap 1000ms.
*   Slave menghitung `offset = master_millis - slave_millis`.
*   Saat terjadi *interrupt*, Slave mencatat `millis()` lokal, lalu menambahkan `offset` untuk mendapatkan waktu absolut.

### C. Aturan Emas ISR (Interrupt Service Routine)
*   **Wajib:** Gunakan `IRAM_ATTR` dan variabel `volatile`.
*   **Dilarang Keras:** Menggunakan `String`, `Serial.print`, atau fungsi berat di dalam ISR. ISR hanya mencatat `millis()` ke variabel dan mengubah *flag*.
*   **Debounce:** Di dalam ISR, gunakan *lockout time* (150ms) untuk mencegah *bouncing* mekanik membanjiri memori.

```cpp
volatile bool hasPendingEvent = false;
volatile unsigned long pendingLocalTime = 0;
volatile unsigned long lastInterruptTime = 0; 

void IRAM_ATTR onButtonPress() {
    unsigned long currentTime = millis();
    if (currentTime - lastInterruptTime > 150) { // Debounce 150ms
        if (!hasPendingEvent) {
            pendingLocalTime = currentTime;
            hasPendingEvent = true;
            lastInterruptTime = currentTime;
        }
    }
}
```

### D. Network & Data Integrity (Anti-Crash & Anti-Loss)
*   **Library MQTT:** Wajib menggunakan **`AsyncMqttClient`**. Dilarang menggunakan `PubSubClient` (bersifat *blocking* dan bisa memicu *bootloop* WDT saat WiFi putus).
*   **Local Queue:** Master menyimpan data di `std::queue` (RAM). Jika WiFi putus, *void loop()* tetap berjalan (non-blocking). Saat WiFi pulih, antrean dikirim ulang dengan MQTT **QoS 1**.
*   **Watchdog Timer (WDT):** Diaktifkan di Master & Slave (timeout 5 detik). Panggil `esp_task_wdt_reset()` di dalam `void loop()`. Jika ESP32 *hang* karena EMI pompa, alat akan *restart* otomatis dan kembali siaga.

---

## V. CARA KERJA SISTEM
1.  **Booting:** Master menyala, mengirim `PING`. Slave merespons ID via DIP Switch. LED berubah Kuning.
2.  **Sync Time:** Master mem-broadcast `SYNC` tiap 1 detik. LED Slave berubah Hijau (Ready).
3.  **Start Lomba:** Master tombol Start ditekan → Broadcast `START` via RS485 → JQ6500 memutar suara start.
4.  **Pencatatan:** 
    *   Perenang menyentuh *touchpad*.
    *   ISR Slave terpicu (0 mikrodetik), mencatat `millis()` lokal, menghitung *offset*, dan menyalakan *flag*.
    *   Master melakukan *polling*, Slave mengirim data `DATA:<Lane>:<Tipe>:<Waktu_Absolut>`.
    *   Master memasukkan data ke *Local Queue* dan mengirimkannya ke Server via MQTT (QoS 1).
5.  **Server:** Menyimpan *Primary Time* (Perenang) dan *Backup Time* (Manusia).

---

## VI. TINDAKAN KESELAMATAN (SAFETY PRECAUTIONS)
1.  **Wajib RCD/GFCI:** Instalasi pompa air kolam **wajib** menggunakan MCB/RCD (Ground Fault Circuit Interrupter).
2.  **Bonding Kolam:** Grounding dan bonding (besi kolam, pipa, pompa) diverifikasi teknisi listrik.
3.  **Cek Stray Voltage:** Ukur tegangan air kolam ke *earth*. Jika > 1V AC, perbaiki pompa sebelum alat dipasang.
4.  **Keamanan Konektor:** Penggunaan SP21 plastik IP68 mencegah korosi kaporit dan sengatan listrik jika terjadi kebocoran arus 24V.
5.  **Isolasi Galvanik:** Kabel tombol wajib melewati Optocoupler (24V → Opto → ESP32) untuk memblokir induksi pompa.
6.  **Terminasi 120 Ohm:** Hanya dipasang di Master dan Slave terakhir (Slave 4 Sisi A dan B) untuk mencegah pantulan sinyal RS485.

---

### STATUS AKHIR
Dengan DED Revisi 4.0 ini, sistem "Rucika" telah dirancang untuk kebal terhadap:
*   **Tabrakan Data** (diatasi dengan *High-Speed Polling*).
*   **Drift Waktu** (diatasi dengan sinkronisasi *offset* 1 detik).
*   **Bouncing Tombol** (diatasi dengan *Debounce* Hardware ISR).
*   **EMI Pompa** (diatasi dengan Optocoupler, RS485, dan SP21 IP68).
*   **WiFi Drop / Bootloop** (diatasi dengan *AsyncMqttClient* dan *Local Queue*).
*   **ESP32 Hang** (diatasi dengan WDT).
