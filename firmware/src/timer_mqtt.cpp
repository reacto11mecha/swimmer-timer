#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ================== BUTTON ==================
#define BTN_START 25
#define BTN_LAP   26
#define BTN_RESET 13

// ================== WIFI ==================
#define WIFI_SSID     "Wokwi-GUEST"
#define WIFI_PASSWORD ""

// ================== SCREEN ==================
#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 64 // OLED display height, in pixels
#define OLED_ADDRES 0x3C // Alat i2c
#define OLED_RESET    -1 // Reset pin # (or -1 if sharing Arduino reset pin)

// ================== MQTT ==================
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port     = 1883;
const char* mqtt_user   = "";
const char* mqtt_pass   = "";
const char* device_id   = "timer-1";

// ================== TOPIC ==================
const char* topic_telemetry       = "timer/telemetry";
const char* topic_lap             = "timer/lap";
const char* topic_status          = "timer/status";

// ================== STATE ==================
enum State { IDLE, RUNNING };
State currentState = IDLE;

// ================== TIMER ==================
unsigned long startMillis       = 0;
unsigned long lastDisplayUpdate = 0;
unsigned long btn1Last          = 0;
unsigned long btn2Last          = 0;
unsigned long btnResetLast      = 0;
unsigned long lastMsgTime       = 0;

int lapNum = 1;
const long interval = 5000;



// ================== MQTT ==================
WiFiClient espClient;
PubSubClient client(espClient);

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);



// ================== RECONNECT ==================
void reconnect() {
  static unsigned long lastAttempt = 0;

  if (millis() - lastAttempt > 5000) {
    lastAttempt = millis();

    Serial.print("MQTT connecting...");

    if (client.connect(device_id, mqtt_user, mqtt_pass, topic_status, 1, true, "offline")) {
      Serial.println("connected");
      client.publish(topic_status, "online", true);
    } else {
      Serial.print("failed rc=");
      Serial.println(client.state());
    }
  }
}



// ================== PRINT TIME ==================
void printElapsed(unsigned long elapsed) {
  unsigned long ms = elapsed % 1000;
  unsigned long s = (elapsed / 1000) % 60;
  unsigned long m = (elapsed / 60000) % 60;


  char buf[32];
  sprintf(buf, "%02lu:%02lu.%03lu", m, s, ms);

  display.setCursor(0, 0);
  display.println(buf);
}




// ================== SETUP ==================
void setup() {
  Serial.begin(9600);
  delay(200);

  if(!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRES)) { 
    Serial.println(F("SSD1306 allocation failed"));
    for(;;); // Don't proceed, loop forever
  }

  Serial.println("Connecting WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    display.clearDisplay(); // Clear buffer
    display.setTextSize(1); // Set text size
    display.setTextColor(SSD1306_WHITE); // Set color (white/black)
    display.setCursor(0,0); // Set cursor position (x, y)
    display.println("Connecting to " WIFI_SSID ); // Add text to buffer

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    display.print("."); // Add text to buffer
    display.display(); // Actually display the text
  }

  Serial.println("\nWiFi connected");
  Serial.println(WiFi.localIP());
    display.println("Connected"); // Add text to buffer
    display.display(); // Actually display the text

  client.setServer(mqtt_server, mqtt_port);
  client.setKeepAlive(5);
  client.setSocketTimeout(2);

  pinMode(BTN_START, INPUT_PULLUP);
  pinMode(BTN_LAP, INPUT_PULLUP);
  pinMode(BTN_RESET, INPUT_PULLUP);

  Serial.println("Setup done");
    display.clearDisplay(); // Clear buffer
    display.setTextSize(2); // Set text size
    display.setTextColor(SSD1306_WHITE); // Set color (white/black)
    display.setCursor(15,15); // Set cursor position (x, y)
    display.println("booting...."); // Add text to buffer
    display.display(); // Actually display the text
}





// ================== LOOP ==================
void loop() {
  display.clearDisplay(); // Clear buffer
  display.setTextSize(1); // Set text size
  display.setTextColor(SSD1306_WHITE); // Set color (white/black)
  display.setCursor(0,0); // Set cursor position (x, y)
  display.println(WiFi.RSSI()); // Add text to buffer
  display.setCursor(109,0); // Set cursor position (x, y)
  display.print(random(70, 90)); // Add text to buffer
  display.print("%"); // Add text to buffer
if (currentState == RUNNING) {
  // Timer jalan
  display.setTextSize(2);
  display.setCursor(40,20);
  display.println("RUN");
} 
else {
  display.setTextSize(2);
  display.setCursor(40,20);
  display.println("READY");
}
display.display(); // Actually display the text

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi reconnect...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    display.clearDisplay(); // Clear buffer
    display.setTextSize(1); // Set text size
    display.setTextColor(SSD1306_WHITE); // Set color (white/black)
    display.setCursor(0,0); // Set cursor position (x, y)
    display.print("reconnect"); // Add text to buffer
    
  }
    while (WiFi.status() != WL_CONNECTED) {
      delay (500);
      display.print("."); // Add text to buffer
      Serial.print(".");
      display.display(); // Actually display the text
    }

  if (!client.connected()) {
    reconnect();
  }

  client.loop();





  // ================== START/STOP ==================
  if (digitalRead(BTN_START) == LOW && millis() - btn1Last > 200) {
    btn1Last = millis();

    if (currentState == IDLE) {
      currentState = RUNNING;
      startMillis = millis();
      Serial.println("START");

    } else {
      currentState = IDLE;
      Serial.println("STOP");

    }
  }






  // ================== RESET ==================
  if (digitalRead(BTN_RESET) == LOW && millis() - btnResetLast > 200) {
    btnResetLast = millis();

    currentState = IDLE;
    startMillis = 0;
    lapNum = 1;

    Serial.println("RESET");
  }





  // ================== RUNNING ==================
  if (currentState == RUNNING) {
    unsigned long now = millis();

    if (now - lastDisplayUpdate >= 100) {
      printElapsed(now - startMillis);
      lastDisplayUpdate = now;
    }

    // ================== LAP ==================
    if (digitalRead(BTN_LAP) == LOW && millis() - btn2Last > 200) {
      Serial.println("LAP");

      unsigned long elapsed = millis() - startMillis;

      JsonDocument doc;
      doc["node"] = device_id;
      doc["time_ms"] = elapsed;
      doc["lap"] = lapNum;

      char buffer[256];
      serializeJson(doc, buffer);
      client.publish(topic_lap, buffer);

      lapNum++;
    }
  }



  

  // ================== TELEMETRY ==================
  unsigned long now = millis();
  if (now - lastMsgTime > interval) {
    lastMsgTime = now;

    JsonDocument doc;
    doc["node"] = device_id;
    doc["wifi_rssi"] = WiFi.RSSI();
    doc["battery"] = random(70, 90);

    char buffer[256];
    serializeJson(doc, buffer);

    client.publish(topic_telemetry, buffer);
  }

  delay(10);
 }
