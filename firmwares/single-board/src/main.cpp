#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

volatile bool flagStartTriggered = false;

extern void mqtt_init();
extern void mqtt_maintain_connection();
extern PubSubClient mqttClient;
extern uint8_t currentBatteryPct;

extern void hardware_init();
extern void hardware_loop();
extern void hardware_play_sound(uint8_t track_num); // Deklarasi fungsi DFPlayer

QueueHandle_t lapQueue;
volatile RaceState currentState = STATE_READY;
volatile uint32_t startTimeMs = 0;

const uint32_t DEBOUNCE_STARTER_MS = 1000;
const uint32_t DEBOUNCE_LANE_MS = 3000;

// Fungsi ISR untuk Starter (Pin 23)
void IRAM_ATTR starter_isr() {
  static uint32_t last_starter_time = 0;
  uint32_t now = millis();

  if (currentState == STATE_READY && (now - last_starter_time > DEBOUNCE_STARTER_MS)) {
    if (digitalRead(PIN_STARTER) == LOW) {
      startTimeMs = now;
      currentState = STATE_RUNNING;
      last_starter_time = now;
      flagStartTriggered = true;
    }
  }
}

// Fungsi ISR untuk Lane 1-8
void IRAM_ATTR lane_isr(void *arg) {
  if (currentState != STATE_RUNNING) return;
  uint32_t lapTime = millis();
  uint8_t lane = (uint32_t)arg;

  static uint32_t last_lap_time[8] = {0};

  if (lapTime - last_lap_time[lane - 1] > DEBOUNCE_LANE_MS) {
    if (digitalRead(PIN_LANES[lane - 1]) == LOW) {
      last_lap_time[lane - 1] = lapTime;
      LapEvent event;
      event.lane_number = lane;
      event.elapsed_ms = lapTime - startTimeMs;

      BaseType_t xHigherPriorityTaskWoken = pdFALSE;
      xQueueSendFromISR(lapQueue, &event, &xHigherPriorityTaskWoken);
      if (xHigherPriorityTaskWoken) {
        portYIELD_FROM_ISR();
      }
    }
  }
}

// --- FREERTOS TASKS ---
void TaskNetwork(void *pvParameters) {
  mqtt_init();
  LapEvent receivedEvent;
  uint32_t lastTelemetryTime = 0;

  for (;;) {
    mqtt_maintain_connection();

    if (mqttClient.connected()) {
      // 1. Cek Lapping
      if (xQueueReceive(lapQueue, &receivedEvent, 0) == pdPASS) {
        JsonDocument doc;
        doc["lane"] = receivedEvent.lane_number;
        doc["elapsed_ms"] = receivedEvent.elapsed_ms;
        String payload;
        serializeJson(doc, payload);
        mqttClient.publish(TOPIC_EVT_LAP, payload.c_str());
      }

      // 2. Cek Starter
      if (flagStartTriggered) {
        flagStartTriggered = false;

        // --- MAINKAN SUARA START (Trek 0001.mp3) ---
        hardware_play_sound(1);

        JsonDocument doc;
        doc["status"] = "STARTED";
        String payload;
        serializeJson(doc, payload);
        mqttClient.publish(TOPIC_EVT_START, payload.c_str());
      }

      // 3. Kirim Telemetri
      uint32_t now = millis();
      if (now - lastTelemetryTime > 5000) {
        lastTelemetryTime = now;
        JsonDocument doc;
        doc["batt_pct"] = currentBatteryPct; // Selalu 100 karena diset statis
        doc["rssi"] = WiFi.RSSI();
        doc["current_state"] = (currentState == STATE_READY) ? "READY" :
                               (currentState == STATE_RUNNING) ? "RUNNING" : "STOPPED";
        String payload;
        serializeJson(doc, payload);
        mqttClient.publish(TOPIC_TELEMETRY, payload.c_str());
      }
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void TaskHardware(void *pvParameters) {
  hardware_init();
  for (;;) {
    hardware_loop();
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

void setup() {
  Serial.begin(115200);

  lapQueue = xQueueCreate(20, sizeof(LapEvent));

  pinMode(PIN_STARTER, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_STARTER), starter_isr, FALLING);

  for (int i = 0; i < 8; i++) {
    pinMode(PIN_LANES[i], INPUT_PULLUP);
    attachInterruptArg(digitalPinToInterrupt(PIN_LANES[i]), lane_isr, (void *)(uint32_t)(i + 1), FALLING);
  }

  xTaskCreatePinnedToCore(TaskNetwork, "NetworkTask", 4096, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(TaskHardware, "HardwareTask", 4096, NULL, 1, NULL, 1);
}

void loop() {
  vTaskDelete(NULL);
}
