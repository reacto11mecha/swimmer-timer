import mqtt from "mqtt";

// Gunakan URL MQTT dari .env
const brokerUrl =
	process.env.VITE_MQTT_WS_URL ||
	process.env.MQTT_URL ||
	"mqtt://127.0.0.1:1883";

/**
 * Fungsi internal generic untuk mem-publish command ke hardware
 * Topik secara otomatis mengikuti konvensi: swimtimer/cmd/<commandName>
 */
function publishCommand(commandName: string, payload: object = {}) {
	return new Promise((resolve, reject) => {
		console.log("connect", brokerUrl);
		const client = mqtt.connect(brokerUrl);
		console.log(client);

		client.on("connect", () => {
			const topic = `swimtimer/cmd/${commandName}`;

			client.publish(topic, JSON.stringify(payload), (err) => {
				if (err) {
					console.error(`[MQTT] Gagal mengirim command ke ${topic}:`, err);
					reject(err);
				} else {
					console.log(`[MQTT] Sinyal ${topic} berhasil dikirim.`);
					resolve(true);
				}
				// Segera tutup koneksi agar tidak terjadi memory leak di server
				client.end();
			});
		});

		client.on("error", (err) => {
			console.error("[MQTT] Client Error:", err);
			client.end();
			reject(err);
		});
	});
}

/**
 * Mengirim perintah RESET ke ESP32
 * Topik: swimtimer/cmd/control
 * payload { command: "RESET" }
 */
export async function publishResetToHardware() {
	return publishCommand("control", { command: "RESET" });
}

/**
 * (Opsional) Mengirim perintah STOP paksa ke ESP32
 * Topik: swimtimer/cmd/control
 * payload { command: "STOP" }
 */
export async function publishStopToHardware() {
	return publishCommand("control", { command: "STOP" });
}
