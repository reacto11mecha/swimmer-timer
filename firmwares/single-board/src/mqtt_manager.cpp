#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

extern volatile RaceState currentState;
extern volatile uint32_t startTimeMs;

const char *WIFI_SSID = "hitoriejaya";
const char *WIFI_PASS = "rularulayabalalala";
const char *MQTT_BROKER = "192.168.0.2";
const int MQTT_PORT = 1883;
const char *MQTT_CLIENT_ID = "SwimTimerBox_01";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

void mqtt_callback(char *topic, byte *payload, unsigned int length) {
    String msg = "";
    for (unsigned int i = 0; i < length; i++) {
        msg += (char)payload[i];
    }

    // Serial.printf("Pesan masuk di topik %s: %s\n", topic, msg.c_str());
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, msg);

    if (error) return;

    if (String(topic) == TOPIC_CMD_CONTROL) {
        String cmd = doc["command"].as<String>();
        if (cmd == "STOP") {
            currentState = STATE_STOPPED;
        } else if (cmd == "RESET") {
            currentState = STATE_READY;
            startTimeMs = 0;
        }
    }
    // --- LOGIKA PING-PONG BARU ---
    else if (String(topic) == "swimtimer/cmd/ping") {
        // Ambil timestamp dari web, lalu kirim balik utuh-utuh
        JsonDocument replyDoc;
        replyDoc["timestamp"] = doc["timestamp"];
        String replyStr;
        serializeJson(replyDoc, replyStr);

        mqttClient.publish("swimtimer/evt/pong", replyStr.c_str());
    }
}

void mqtt_init() {
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqtt_callback);
    mqttClient.setBufferSize(512);
}

void mqtt_maintain_connection() {
    if (WiFi.status() != WL_CONNECTED) {
        WiFi.begin(WIFI_SSID, WIFI_PASS);
        uint32_t startAttempt = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 5000) {
            vTaskDelay(pdMS_TO_TICKS(100));
        }
    }

    if (!mqttClient.connected()) {
        if (mqttClient.connect(MQTT_CLIENT_ID)) {
            mqttClient.subscribe(TOPIC_CMD_SETUP);
            mqttClient.subscribe(TOPIC_CMD_CONTROL);
            mqttClient.subscribe("swimtimer/cmd/ping");
        }
    }

    mqttClient.loop();
}
