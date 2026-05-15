import mqtt from "mqtt";

export async function publishResetToHardware() {
  return new Promise((resolve, reject) => {
    // Gunakan URL MQTT dari .env
    const brokerUrl = process.env.VITE_MQTT_URL || "mqtt://127.0.0.1:1883";
    const client = mqtt.connect(brokerUrl);

    client.on("connect", () => {
      // Publish payload reset
      client.publish(
        "server/reset",
        JSON.stringify({ command: "RESET" }),
        (err) => {
          if (err) {
            console.error("Gagal mengirim reset MQTT:", err);
            reject(err);
          } else {
            console.log("Sinyal server/reset berhasil dikirim ke perangkat.");
            resolve(true);
          }
          // Segera tutup koneksi agar tidak memory leak di web server
          client.end();
        },
      );
    });

    client.on("error", (err) => {
      console.error("MQTT Client Error:", err);
      client.end();
      reject(err);
    });
  });
}
