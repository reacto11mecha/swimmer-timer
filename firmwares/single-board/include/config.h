#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// --- PIN DEFINITIONS ---
const uint8_t PIN_STARTER = 23;
const uint8_t PIN_LANES[8] = {13, 12, 14, 27, 26, 25, 33, 32};

// I2C untuk OLED & RTC
const uint8_t I2C_SDA = 19;
const uint8_t I2C_SCL = 18;

// UART2 untuk DFPlayer
const uint8_t DFPLAYER_RX = 16;
const uint8_t DFPLAYER_TX = 17;

// --- MQTT TOPICS ---
#define TOPIC_CMD_SETUP "swimtimer/cmd/setup"
#define TOPIC_CMD_CONTROL "swimtimer/cmd/control"
#define TOPIC_EVT_START "swimtimer/evt/start"
#define TOPIC_EVT_LAP "swimtimer/evt/lap"
#define TOPIC_TELEMETRY "swimtimer/telemetry"

// --- STATE MACHINE ---
enum RaceState {
    STATE_READY,
    STATE_RUNNING,
    STATE_STOPPED
};

// --- DATA STRUCTURES (Untuk FreeRTOS Queue) ---
struct LapEvent {
    uint8_t lane_number;
    uint32_t elapsed_ms;
};

#endif
