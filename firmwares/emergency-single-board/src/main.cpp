#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

volatile bool flagStartTriggered = false; // Flag untuk memberi tahu Network Task

extern void mqtt_init();
extern void mqtt_maintain_connection();
extern PubSubClient mqttClient;
extern volatile bool flagStartTriggered;
extern uint8_t currentBatteryPct;

extern void hardware_init();
extern void hardware_loop();

// Antrean data untuk menampung event lap dari interrupt
QueueHandle_t lapQueue;

// Variabel state harus volatile karena diakses oleh ISR dan Task
volatile RaceState currentState = STATE_READY;
volatile uint32_t startTimeMs = 0;

// Konstanta debounce (dalam milidetik)
const uint32_t DEBOUNCE_STARTER_MS = 1000; // Starter tidak bisa ditekan 2x dalam 1 detik
const uint32_t DEBOUNCE_LANE_MS = 3000;    // Perenang tidak mungkin menyentuh dinding 2x dalam 3 detik

// --- INTERRUPT SERVICE ROUTINES (ISR) ---
// ISR harus secepat mungkin. Tidak boleh ada delay(), Serial.print(), atau koneksi jaringan di sini.

// Fungsi ISR untuk Starter (Pin 23)
void IRAM_ATTR starter_isr()
{
  static uint32_t last_starter_time = 0;
  uint32_t now = millis();

  // Syarat: State harus READY, dan sudah melewati waktu debounce
  if (currentState == STATE_READY && (now - last_starter_time > DEBOUNCE_STARTER_MS))
  {
    // Karena pakai INPUT_PULLUP, tombol ditekan = LOW (0).
    // Kita bisa tambahkan double check state pin fisik untuk menghindari noise induksi
    if (digitalRead(PIN_STARTER) == LOW)
    {
      startTimeMs = now;
      currentState = STATE_RUNNING;
      last_starter_time = now;
      flagStartTriggered = true;

      // Flag agar TaskNetwork tahu harus kirim MQTT
      // (Akan diimplementasikan saat bahas MQTT)
    }
  }
}

// Fungsi ISR untuk Lane 1-8
void IRAM_ATTR lane_isr(void *arg)
{
  // Tombol lane hanya merespon jika perlombaan sedang berjalan
  if (currentState != STATE_RUNNING)
    return;

  uint32_t lapTime = millis();
  uint8_t lane = (uint32_t)arg;

  // Array statis untuk menyimpan kapan terakhir kali masing-masing lane ditekan
  static uint32_t last_lap_time[8] = {0};

  // Cek debounce untuk lane spesifik ini
  if (lapTime - last_lap_time[lane - 1] > DEBOUNCE_LANE_MS)
  {

    // Double check pin fisik untuk memastikan ini bukan noise listrik
    if (digitalRead(PIN_LANES[lane - 1]) == LOW)
    {
      last_lap_time[lane - 1] = lapTime;

      LapEvent event;
      event.lane_number = lane;
      event.elapsed_ms = lapTime - startTimeMs;

      // Masukkan data sentuhan ke antrean FreeRTOS
      BaseType_t xHigherPriorityTaskWoken = pdFALSE;
      xQueueSendFromISR(lapQueue, &event, &xHigherPriorityTaskWoken);

      if (xHigherPriorityTaskWoken)
      {
        portYIELD_FROM_ISR();
      }
    }
  }
}

// --- FREERTOS TASKS ---

void TaskNetwork(void *pvParameters)
{
  mqtt_init();
  LapEvent receivedEvent;
  uint32_t lastTelemetryTime = 0;

  for (;;)
  {
    mqtt_maintain_connection();

    if (mqttClient.connected())
    {
      // 1. Cek apakah ada Event Lapping dari Queue
      if (xQueueReceive(lapQueue, &receivedEvent, 0) == pdPASS)
      {
        JsonDocument doc;
        doc["lane"] = receivedEvent.lane_number;
        doc["elapsed_ms"] = receivedEvent.elapsed_ms;

        String payload;
        serializeJson(doc, payload);
        mqttClient.publish(TOPIC_EVT_LAP, payload.c_str());
      }

      // 2. Cek apakah Starter baru saja ditekan
      if (flagStartTriggered)
      {
        flagStartTriggered = false; // Reset flag

        JsonDocument doc;
        doc["status"] = "STARTED";
        String payload;
        serializeJson(doc, payload);
        mqttClient.publish(TOPIC_EVT_START, payload.c_str());
      }

      // 3. Kirim Telemetri setiap 5 detik
      uint32_t now = millis();
      if (now - lastTelemetryTime > 5000)
      {
        lastTelemetryTime = now;

        JsonDocument doc;
        doc["batt_pct"] = currentBatteryPct;
        doc["rssi"] = WiFi.RSSI();
        doc["current_state"] = (currentState == STATE_READY) ? "READY" : (currentState == STATE_RUNNING) ? "RUNNING"
                                                                                                         : "STOPPED";

        String payload;
        serializeJson(doc, payload);
        mqttClient.publish(TOPIC_TELEMETRY, payload.c_str());
      }
    }

    vTaskDelay(pdMS_TO_TICKS(10)); // Penting: mencegah Watchdog Timeout
  }
}

void TaskHardware(void *pvParameters)
{
  hardware_init();

  for (;;)
  {
    hardware_loop();                // Refresh layar dan baca sensor
    vTaskDelay(pdMS_TO_TICKS(100)); // Layar diupdate ~10fps sudah sangat cukup
  }
}

void setup()
{
  Serial.begin(115200);

  // Buat Queue untuk menampung maksimal 20 event sentuhan (sangat cukup)
  lapQueue = xQueueCreate(20, sizeof(LapEvent));

  // Setup Starter
  pinMode(PIN_STARTER, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_STARTER), starter_isr, FALLING);

  // Setup Lanes
  for (int i = 0; i < 8; i++)
  {
    pinMode(PIN_LANES[i], INPUT_PULLUP);
    // Attach ISR dengan melempar parameter nomor lane (1-8)
    attachInterruptArg(digitalPinToInterrupt(PIN_LANES[i]), lane_isr, (void *)(uint32_t)(i + 1), FALLING);
  }

  // Assign tugas ke Core ESP32
  // Core 0 untuk jaringan/MQTT, Core 1 (default Arduino) untuk hardware/display
  xTaskCreatePinnedToCore(TaskNetwork, "NetworkTask", 4096, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(TaskHardware, "HardwareTask", 4096, NULL, 1, NULL, 1);
}

void loop()
{
  // Loop kosong. Semua logika sudah ditangani oleh ISR dan FreeRTOS Tasks.
  vTaskDelete(NULL);
}