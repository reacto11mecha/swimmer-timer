// apps/web/src/server/mqtt-client.ts
import mqtt from "mqtt";

const MQTT_BROKER = process.env.MQTT_URL || "mqtt://192.168.0.6:1883";

// Buat koneksi persisten
const client = mqtt.connect(MQTT_BROKER, {
  clientId: `server_${Math.random().toString(16).slice(2, 8)}`,
  clean: true,
  keepalive: 60,
});

client.on("connect", () => {
  console.log("[MQTT Client] Terhubung ke broker (persisten)");
});

client.on("error", (err) => {
  console.error("[MQTT Client] Error:", err);
});

// Fungsi publish yang menggunakan koneksi yang sudah ada
export function publishCommand(commandName: string, payload: object = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const topic = `swimtimer/cmd/${commandName}`;
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error(`[MQTT] Gagal publish ke ${topic}:`, err);
        reject(err);
      } else {
        console.log(`[MQTT] Sinyal ${topic} berhasil dikirim.`);
        resolve();
      }
    });
  });
}

export default client;
