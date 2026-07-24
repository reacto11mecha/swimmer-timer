// firmwares/emergency-single-board/src/mqtt_manager.cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

// Ambil variabel dari main.cpp & hardware.cpp
extern volatile RaceState currentState;
extern volatile uint32_t startTimeMs;
extern uint8_t currentBatteryPct;

// Kredensial (Ganti dengan milik Anda)
const char *WIFI_SSID = "hitoriejaya";
const char *WIFI_PASS = "rularulayabalalala";
const char *MQTT_BROKER = "192.168.0.6"; // IP Server Go / Mosquitto Anda
const int MQTT_PORT = 1883;
const char *MQTT_CLIENT_ID = "SwimTimerBox_01";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Fungsi Callback jika ada pesan masuk dari Server
void mqtt_callback(char *topic, byte *payload, unsigned int length) {
    String msg = "";
    for (unsigned int i = 0; i < length; i++) {
        msg += (char)payload[i];
    }

    Serial.printf("Pesan masuk di topik %s: %s\n", topic, msg.c_str());

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, msg);
    if (error) {
        Serial.println("Gagal parsing JSON!");
        return;
    }

    if (String(topic) == TOPIC_CMD_CONTROL) {
        String cmd = doc["command"].as<String>();
        Serial.printf("CMD diterima: %s\n", cmd.c_str());
        if (cmd == "STOP") {
            currentState = STATE_STOPPED;
            Serial.println("State berubah ke STOPPED");
        } else if (cmd == "RESET") {
            currentState = STATE_READY;
            startTimeMs = 0;
            Serial.println("State berubah ke READY, startTimeMs direset");
        } else {
            Serial.println("CMD tidak dikenali");
        }
    }
}

void mqtt_init()
{
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqtt_callback);
    // Tingkatkan buffer jika JSON setup dari server sangat besar
    mqttClient.setBufferSize(512);
}

void mqtt_maintain_connection()
{
    // Jaga koneksi WiFi
    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.print("Connecting to WiFi...");
        WiFi.begin(WIFI_SSID, WIFI_PASS);
        uint32_t startAttempt = millis();
        // Coba konek selama 5 detik, agar tidak memblokir task selamanya
        while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 5000)
        {
            vTaskDelay(pdMS_TO_TICKS(100));
        }
        if (WiFi.status() == WL_CONNECTED)
            Serial.println(" Terhubung!");
        else
        {
            Serial.println(" Gagal.");
            return;
        }
    }

    // Jaga koneksi MQTT
    if (!mqttClient.connected())
    {
        Serial.print("Connecting to MQTT...");
        if (mqttClient.connect(MQTT_CLIENT_ID))
        {
            Serial.println(" Terhubung!");
            // Subscribe ke command dari server
            mqttClient.subscribe(TOPIC_CMD_SETUP);
            mqttClient.subscribe(TOPIC_CMD_CONTROL);
        }
        else
        {
            Serial.print(" Gagal, rc=");
            Serial.println(mqttClient.state());
        }
    }

    mqttClient.loop(); // Wajib dipanggil untuk memproses incoming message & ping
}
