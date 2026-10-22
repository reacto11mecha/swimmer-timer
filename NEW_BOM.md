Tentu, berikut adalah **Bill of Materials (BOM) Final** yang terpisah dan sudah disesuaikan dengan DED Revisi 4.0. Tabel ini dirancang agar Anda bisa langsung meng-copy-nya ke Excel atau membawanya ke toko elektronik.

Kebutuhan dihitung berdasarkan **1 Unit Master** dan **8 Unit Slave** (4 di Sisi A, 4 di Sisi B).

---

### TABEL BILL OF MATERIALS (BOM) SISTEM "RUCIKA"

#### A. KOMPONEN UNIT MASTER (1 Unit)
| No | Nama Komponen | Spesifikasi / Detail | Qty |
|:---|:---|:---|:---|
| 1 | ESP32 Wroom 32 | Modul Mikrokontroler 30 Pin | 1 |
| 2 | Modul W5500 | Ethernet LAN (SPI) | 1 |
| 3 | Modul JQ6500 | MP3 Player Module (Serial) | 1 |
| 4 | Audio Isolation Transformer | 1:1 600 Ohm | 1 |
| 5 | Soket Audio | Akai Female Mono 6.5mm | 1 |
| 6 | PSU 24V DC | Power Supply 24V (min. 3A) | 1 |
| 7 | Modul LM2596 | Step-down DC-DC (24V ke 5V) | 1 |
| 8 | IC LM7805 | Regulator Tegangan 5V (TO-220) | 1 |
| 9 | Kapasitor Elco | 470uF / 35V | 1 |
| 10 | Kapasitor Elco | 47uF / 16V | 1 |
| 11 | Kapasitor Keramik | 104 (100nF) | 1 |
| 12 | Optocoupler | PC817 | 1 |
| 13 | Resistor | 2.2 kΩ (1/2 Watt) | 1 |
| 14 | Resistor | 4.7 kΩ (1/4 Watt) | 1 |
| 15 | Modul RS485 | XY-K485 (Hardware Auto-Direction) | 1 |
| 16 | Resistor + Jumper | 120 Ohm + Jumper Cap (Terminasi) | 1 set |
| 17 | LED Indikator | WS2812B (RGB Addressable) | 1 |
| 18 | Konektor Type-C | Female (Jalur VBUS dipotong) | 1 |
| 19 | Konektor Bus Keluar | **SP21 4-Pin Female (Plastik IP68)** | 1 |
| 20 | Tombol Start | Push Button (untuk panitia) | 1 |

#### B. KOMPONEN UNIT SLAVE (8 Unit Total)
*Catatan: Kolom Qty adalah kebutuhan per 1 Unit Slave. Untuk total, kalikan dengan 8.*
| No | Nama Komponen | Spesifikasi / Detail | Qty / Slave | Total (8 Unit) |
|:---|:---|:---|:---|:---|
| 1 | ESP32 Wroom 32 | Modul Mikrokontroler | 1 | 8 |
| 2 | Modul LM2596 | Step-down DC-DC (24V ke 5V) | 1 | 8 |
| 3 | Kapasitor Elco | 1000uF / 16V | 1 | 8 |
| 4 | Kapasitor Keramik | 104 (100nF) | 1 | 8 |
| 5 | Modul RS485 | XY-K485 (Hardware Auto-Direction) | 1 | 8 |
| 6 | Resistor + Jumper | 120 Ohm + Jumper Cap (Terminasi) | 1 set | 8 set |
| 7 | Modul Optocoupler | 4-Channel (Input 24V, Output TTL) | 2 | 16 |
| 8 | DIP Switch | 4-Pin (Untuk setting ID 1-8) | 1 | 8 |
| 9 | LED Indikator | WS2812B (RGB Addressable) | 1 | 8 |
| 10 | Konektor Type-C | Female (Jalur VBUS dipotong) | 1 | 8 |
| 11 | Konektor Bus (In/Out) | **SP21 4-Pin Male (Plastik IP68)** | 2 | 16 |
| 12 | Konektor Tombol | GX12 4-Pin (Female/Male) | 8 | 64 |

#### C. KABEL, AKSESORIS & ENCLOSURE
| No | Nama Komponen | Spesifikasi / Detail | Qty |
|:---|:---|:---|:---|
| 1 | Kabel Bus Utama | **Cat6 FTP** (Foiled Twisted Pair) + Drain Wire | 1 Roll (305m) |
| 2 | Kabel Tombol | Kabel 2 Konduktor (di-twist manual) | ± 100m (menyesuaikan) |
| 3 | Kotak Panel Master | Box Plastik IP65/IP66 (Ukuran sesuai) | 1 |
| 4 | Kotak Panel Slave | Box Plastik IP65/IP66 (Ukuran sesuai) | 8 |
| 5 | PCB / Perfboard | Untuk merakit sirkuit Master & Slave | 9 |
| 6 | Kabel Jumper | Kabel silikon AWG 22/24 (warna-warni) | 1 set |
| 7 | Timah Solder & Flux | - | 1 set |

---
**Catatan Tambahan untuk Pengadaan:**
*   **Modul Optocoupler 4-Channel:** Pastikan membeli modul yang bisa menerima input tegangan 24V DC (biasanya memiliki resistor bawaan di input). Jika hanya tersedia modul 5V, Anda harus menambahkan resistor pembatas arus manual (misal 2.2kΩ) di setiap jalur input tombol.
*   **Modul XY-K485:** Pastikan membeli modul yang memiliki chip dengan fitur *Auto-Direction* (biasanya ditandai dengan tidak perlunya pin kontrol DE/RE dari ESP32).
*   **Tombol GX12:** Anda bisa menggunakan tipe *touchpad* kapasitif atau tombol mekanik *heavy-duty* (yang biasa digunakan di *buzzer* kuis) untuk ketahanan air.
