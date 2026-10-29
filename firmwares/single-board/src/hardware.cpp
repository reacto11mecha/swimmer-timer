#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <RTClib.h>
#include <DFRobotDFPlayerMini.h>
#include "config.h"

// Ambil variabel state dari main.cpp
extern volatile RaceState currentState;
extern volatile uint32_t startTimeMs;

// Inisialisasi Objek Hardware
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/U8X8_PIN_NONE);
RTC_DS3231 rtc;

// Objek untuk DFPlayer menggunakan UART2
HardwareSerial mySerial(2);
DFRobotDFPlayerMini myDFPlayer;

// Variabel statis pengaman (karena ADS1115 dihapus)
uint8_t currentBatteryPct = 100;
String currentTimeStr = "00:00";

void hardware_init() {
    // Inisialisasi I2C
    Wire.begin(I2C_SDA, I2C_SCL);

    // Mulai U8G2 (OLED)
    u8g2.begin();
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_ncenB08_tr);
    u8g2.drawStr(20, 30, "System Booting...");
    u8g2.sendBuffer();

    // Mulai RTC
    if (!rtc.begin(&Wire)) {
        Serial.println("RTC tidak terdeteksi!");
    } else {
        if (rtc.lostPower()) {
            Serial.println("RTC kehilangan daya, mengatur ulang waktu!");
            rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
        }
    }

    // Mulai DFPlayer
    mySerial.begin(9600, SERIAL_8N1, DFPLAYER_RX, DFPLAYER_TX);
    Serial.println("Memulai inisialisasi DFPlayer...");
    if (!myDFPlayer.begin(mySerial)) {
        Serial.println("Gagal menemukan DFPlayer!");
    } else {
        Serial.println("DFPlayer siap!");
        myDFPlayer.volume(30); // Volume Maksimal
    }
}

// Fungsi global untuk dipanggil saat tombol starter ditekan
void hardware_play_sound(uint8_t track_num) {
    myDFPlayer.play(track_num);
}

void hardware_loop() {
    // 1. Baca Waktu RTC
    DateTime now = rtc.now();
    char timeBuffer[6];
    snprintf(timeBuffer, sizeof(timeBuffer), "%02d:%02d", now.hour(), now.minute());
    currentTimeStr = String(timeBuffer);

    // 2. Format Waktu Stopwatch
    char stopwatchBuffer[16] = "00:00.000";
    if (currentState == STATE_RUNNING) {
        uint32_t elapsed = millis() - startTimeMs;
        uint32_t ms = elapsed % 1000;
        uint32_t sec = (elapsed / 1000) % 60;
        uint32_t min = (elapsed / 60000);
        snprintf(stopwatchBuffer, sizeof(stopwatchBuffer), "%02d:%02d.%03d", min, sec, ms);
    }

    // 3. Render ke OLED
    u8g2.clearBuffer();

    // --- Top Bar (Status) ---
    u8g2.setFont(u8g2_font_5x7_tf);
    u8g2.setCursor(0, 7);
    u8g2.print(currentTimeStr);
    u8g2.setCursor(85, 7);
    u8g2.print("PWR: OK"); // Baterai dihapus, indikator statis
    u8g2.drawHLine(0, 10, 128);

    // --- Main Content ---
    u8g2.setFont(u8g2_font_ncenB10_tr);
    u8g2.setCursor(30, 28);
    if (currentState == STATE_READY) u8g2.print("READY");
    else if (currentState == STATE_RUNNING) u8g2.print("RUNNING");
    else if (currentState == STATE_STOPPED) u8g2.print("STOPPED");

    u8g2.setFont(u8g2_font_logisoso16_tr);
    uint8_t w = u8g2.getStrWidth(stopwatchBuffer);
    u8g2.setCursor((128 - w) / 2, 55);

    if (currentState == STATE_RUNNING || currentState == STATE_STOPPED) {
        u8g2.print(stopwatchBuffer);
    } else {
        u8g2.print("00:00.000");
    }

    u8g2.sendBuffer();
}
