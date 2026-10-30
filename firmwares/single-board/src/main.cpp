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
bool isMaintenanceMode = false;

extern void hardware_init();
extern void hardware_loop();
extern void hardware_play_sound(uint8_t track_num); // Deklarasi fungsi DFPlayer

QueueHandle_t lapQueue;
volatile RaceState currentState = STATE_READY;
volatile uint32_t startTimeMs = 0;

const uint32_t DEBOUNCE_STARTER_MS = 1000;
const uint32_t DEBOUNCE_LANE_MS = 3000;

void TaskInput(void *pvParameters) {
  uint32_t last_starter_trigger = 0;
  uint32_t last_lane_trigger[10] = {0};

  bool last_starter_state = HIGH;
  bool last_lane_state[10] = {HIGH, HIGH, HIGH, HIGH, HIGH, HIGH, HIGH, HIGH, HIGH, HIGH};

  for (;;) {
    uint32_t now = millis();

    // --- LOGIKA STARTER ---
    bool current_starter = digitalRead(PIN_STARTER);
    if (last_starter_state == HIGH && current_starter == LOW) {
      if (currentState == STATE_READY && (now - last_starter_trigger > DEBOUNCE_STARTER_MS || last_starter_trigger == 0)) {
        startTimeMs = now;
        currentState = STATE_RUNNING;
        last_starter_trigger = now;
        flagStartTriggered = true;
      }
    }
    last_starter_state = current_starter;

    // --- LOGIKA LANES ---
    if (currentState == STATE_RUNNING) {
      for (int i = 0; i < 10; i++) {
        bool current_lane = digitalRead(PIN_LANES[i]);
        if (last_lane_state[i] == HIGH && current_lane == LOW) {
          if (now - last_lane_trigger[i] > DEBOUNCE_LANE_MS || last_lane_trigger[i] == 0) {
            last_lane_trigger[i] = now;
            LapEvent event;
            event.lane_number = i + 1;
            event.elapsed_ms = now - startTimeMs;
            xQueueSend(lapQueue, &event, 0);
          }
        }
        last_lane_state[i] = current_lane;
      }
    }

    vTaskDelay(pdMS_TO_TICKS(5)); // Low-Pass filter mekanik
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

        // UBAH LOGIKA PUBLISH INI:
        if (isMaintenanceMode) {
          mqttClient.publish("swimtimer/test/lap", payload.c_str());
        } else {
          mqttClient.publish(TOPIC_EVT_LAP, payload.c_str());
        }
      }

      // 2. Cek Starter
      if (flagStartTriggered) {
        flagStartTriggered = false;
        hardware_play_sound(1);

        JsonDocument doc;
        doc["status"] = "STARTED";
        String payload;
        serializeJson(doc, payload);

        // UBAH LOGIKA PUBLISH INI:
        if (isMaintenanceMode) {
          mqttClient.publish("swimtimer/test/start", payload.c_str());
        } else {
          mqttClient.publish(TOPIC_EVT_START, payload.c_str());
        }
      }

      // 3. Kirim Telemetri (Tambahkan status maintenance)
      uint32_t now = millis();
      if (now - lastTelemetryTime > 5000) {
        lastTelemetryTime = now;
        JsonDocument doc;
        doc["batt_pct"] = currentBatteryPct;
        doc["rssi"] = WiFi.RSSI();
        doc["current_state"] = (currentState == STATE_READY) ? "READY" :
                               (currentState == STATE_RUNNING) ? "RUNNING" : "STOPPED";

        // TAMBAHKAN BARIS INI:
        doc["is_maintenance"] = isMaintenanceMode;

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
  for (int i = 0; i < 10; i++) {
    pinMode(PIN_LANES[i], INPUT_PULLUP);
  }
  // HAPUS baris attachInterrupt() di sini

  xTaskCreatePinnedToCore(TaskInput, "InputTask", 4096, NULL, 2, NULL, 0);
  xTaskCreatePinnedToCore(TaskNetwork, "NetworkTask", 4096, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(TaskHardware, "HardwareTask", 4096, NULL, 1, NULL, 1);
}

void loop() {
  vTaskDelete(NULL);
}
