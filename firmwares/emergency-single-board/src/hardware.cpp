#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <RTClib.h>
#include <Adafruit_ADS1X15.h>
#include "config.h"

// Ambil variabel state dari main.cpp
extern volatile RaceState currentState;
extern volatile uint32_t startTimeMs;

// Inisialisasi Objek Hardware
// Menggunakan HW_I2C, u8g2 akan menggunakan instance Wire bawaan Arduino
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/U8X8_PIN_NONE);
RTC_DS3231 rtc;
Adafruit_ADS1115 ads;

// Variabel untuk menampung telemetri (bisa ditarik oleh TaskNetwork nanti)
uint8_t currentBatteryPct = 0;
String currentTimeStr = "00:00";

// Fungsi pembantu untuk menghitung persentase baterai
// (Asumsi baterai LiPo 1S: 3.2V Kosong - 4.2V Penuh, baca via Voltage Divider)
uint8_t calculateBatteryPercentage()
{
    // Membaca Channel 0 pada ADS1115
    int16_t adc0 = ads.readADC_SingleEnded(0);
    float voltage = ads.computeVolts(adc0);

    // Sesuaikan pengali multiplier dengan resistor divider Anda (misal voltage * 2)
    float batteryVoltage = voltage * 2.0;

    if (batteryVoltage >= 4.2)
        return 100;
    if (batteryVoltage <= 3.2)
        return 0;
    return (uint8_t)(((batteryVoltage - 3.2) / 1.0) * 100.0);
}

void hardware_init()
{
    // Inisialisasi I2C dengan custom pin (SDA: 19, SCL: 18)
    Wire.begin(I2C_SDA, I2C_SCL);

    // Mulai U8G2 (OLED)
    u8g2.begin();
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_ncenB08_tr);
    u8g2.drawStr(20, 30, "System Booting...");
    u8g2.sendBuffer();

    // Mulai RTC
    if (!rtc.begin(&Wire))
    {
        Serial.println("RTC tidak terdeteksi!");
    }
    else
    {
        if (rtc.lostPower())
        {
            Serial.println("RTC kehilangan daya, mengatur ulang waktu!");
            // Set ke waktu kompilasi sebagai fallback sementara
            rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
        }
    }

    // Mulai ADS1115
    if (!ads.begin(0x48, &Wire))
    { // 0x48 adalah alamat I2C default ADS1115
        Serial.println("ADS1115 tidak terdeteksi!");
    }
}

void hardware_loop()
{
    // 1. Baca Sensor (RTC & Baterai)
    DateTime now = rtc.now();
    char timeBuffer[6];
    snprintf(timeBuffer, sizeof(timeBuffer), "%02d:%02d", now.hour(), now.minute());
    currentTimeStr = String(timeBuffer);

    currentBatteryPct = calculateBatteryPercentage();

    // 2. Format Waktu Stopwatch (jika sedang berjalan)
    char stopwatchBuffer[16] = "00:00.000";
    if (currentState == STATE_RUNNING)
    {
        uint32_t elapsed = millis() - startTimeMs;
        uint32_t ms = elapsed % 1000;
        uint32_t sec = (elapsed / 1000) % 60;
        uint32_t min = (elapsed / 60000);
        snprintf(stopwatchBuffer, sizeof(stopwatchBuffer), "%02d:%02d.%03d", min, sec, ms);
    }

    // 3. Render ke OLED (Memanfaatkan Page Buffer dari u8g2)
    u8g2.clearBuffer();

    // --- Top Bar (Status) ---
    u8g2.setFont(u8g2_font_5x7_tf);
    u8g2.setCursor(0, 7);
    u8g2.print(currentTimeStr);

    u8g2.setCursor(95, 7);
    u8g2.print("BAT:");
    u8g2.print(currentBatteryPct);
    u8g2.print("%");

    u8g2.drawHLine(0, 10, 128); // Garis pembatas

    // --- Main Content (State & Stopwatch) ---
    u8g2.setFont(u8g2_font_ncenB10_tr);
    u8g2.setCursor(30, 28);
    if (currentState == STATE_READY)
        u8g2.print("READY");
    else if (currentState == STATE_RUNNING)
        u8g2.print("RUNNING");
    else if (currentState == STATE_STOPPED)
        u8g2.print("STOPPED");

    // Tampilkan Stopwatch di tengah dengan font besar
    u8g2.setFont(u8g2_font_logisoso16_tr);

    // Pusatkan teks stopwatch (pendekatan kasar)
    uint8_t w = u8g2.getStrWidth(stopwatchBuffer);
    u8g2.setCursor((128 - w) / 2, 55);

    if (currentState == STATE_RUNNING || currentState == STATE_STOPPED)
    {
        u8g2.print(stopwatchBuffer);
    }
    else
    {
        u8g2.print("00:00.000");
    }

    u8g2.sendBuffer(); // Dorong ke layar fisik
}