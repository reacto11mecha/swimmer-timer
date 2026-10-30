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
  uint32_t last_debug_print = 0;

  for (;;) {
    uint32_t now = millis();
    bool state_changed = false;

    // --- BACA SEMUA PIN ---
    bool current_starter = digitalRead(PIN_STARTER);
    bool current_lanes[10];
    for (int i = 0; i < 10; i++) {
      current_lanes[i] = digitalRead(PIN_LANES[i]);
    }

    // --- DEBUG & LOGIKA STARTER ---
    if (last_starter_state != current_starter) {
      Serial.printf("[DEBUG] PIN STARTER BERUBAH -> %s\n", current_starter == LOW ? "LOW (DITEKAN)" : "HIGH (DILEPAS)");
      state_changed = true;
    }

    if (last_starter_state == HIGH && current_starter == LOW) {
      if (currentState == STATE_READY && (now - last_starter_trigger > DEBOUNCE_STARTER_MS || last_starter_trigger == 0)) {
        startTimeMs = now;
        currentState = STATE_RUNNING;
        last_starter_trigger = now;
        flagStartTriggered = true;
        Serial.println("[SYSTEM] >>> PERLOMBAAN DIMULAI! (STATE_RUNNING) <<<");
      } else {
        Serial.printf("[SYSTEM] Starter ditekan tapi ditolak. Status saat ini: %d\n", currentState);
      }
    }
    last_starter_state = current_starter;

    // --- DEBUG & LOGIKA LANES ---
    for (int i = 0; i < 10; i++) {
      if (last_lane_state[i] != current_lanes[i]) {
        Serial.printf("[DEBUG] PIN LANE %d (Pin %d) BERUBAH -> %s\n", i + 1, PIN_LANES[i], current_lanes[i] == LOW ? "LOW (DITEKAN)" : "HIGH (DILEPAS)");
        state_changed = true;
      }

      if (last_lane_state[i] == HIGH && current_lanes[i] == LOW) {
        if (currentState == STATE_RUNNING) {
          if (now - last_lane_trigger[i] > DEBOUNCE_LANE_MS || last_lane_trigger[i] == 0) {
            last_lane_trigger[i] = now;
            LapEvent event;
            event.lane_number = i + 1;
            event.elapsed_ms = now - startTimeMs;
            xQueueSend(lapQueue, &event, 0);
            Serial.printf("[MQTT] >>> LAP LANE %d TERCATAT! Waktu: %d ms <<<\n", i + 1, event.elapsed_ms);
          } else {
            Serial.printf("[SYSTEM] Lap Lane %d tertahan sistem debounce!\n", i + 1);
          }
        } else {
          Serial.printf("[SYSTEM] Sinyal Lane %d masuk, TAPI DIAIKAN (Sistem belum RUNNING)\n", i + 1);
        }
      }
      last_lane_state[i] = current_lanes[i];
    }

    // --- CETAK LAPORAN RUTIN (Tiap 2 Detik) ATAU SAAT ADA PERUBAHAN ---
    if (now - last_debug_print > 2000 || state_changed) {
      last_debug_print = now;
      Serial.print("[MONITOR] STATE: ");
      Serial.print(currentState == STATE_READY ? "READY" : currentState == STATE_RUNNING ? "RUNNING" : "STOPPED");
      Serial.print(" | STR: "); Serial.print(current_starter == LOW ? "0" : "1");
      Serial.print(" | LANES(1-10): ");
      for(int i = 0; i < 10; i++) {
        Serial.print(current_lanes[i] == LOW ? "0" : "1");
      }
      Serial.println(); // 1 = HIGH (Tidak disentuh), 0 = LOW (Disentuh GND)
    }

    vTaskDelay(pdMS_TO_TICKS(10));
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
