// apps/web/src/server/mqtt-client.ts
import mqtt from "mqtt";

// Deklarasi global agar HMR Vite tidak membuat ulang koneksi baru terus-menerus
const globalForMqtt = globalThis as unknown as {
	mqttClient: mqtt.MqttClient | undefined;
};

// Pola Lazy Singleton: Fungsi ini hanya akan membuat koneksi saat pertama kali dipanggil
export function getMqttClient(): mqtt.MqttClient {
	// Gunakan koneksi yang sudah ada jika tersedia (mencegah koneksi ganda akibat HMR)
	if (globalForMqtt.mqttClient) {
		return globalForMqtt.mqttClient;
	}

	// BACA ENV DI SINI (Di dalam fungsi).
	// TanStack Start menyuntikkan env di level per-request, bukan di module scope.
	const MQTT_BROKER = process.env.MQTT_URL || "mqtt://192.168.0.2:1883";

	const client = mqtt.connect(MQTT_BROKER, {
		clientId: `server_${Math.random().toString(16).slice(2, 8)}`,
		clean: true,
		keepalive: 60,
	});

	client.on("connect", () => {
		console.log(
			`[MQTT Client] Terhubung ke broker TCP di ${MQTT_BROKER} (persisten)`,
		);
	});

	client.on("error", (err) => {
		console.error("[MQTT Client] Error:", err);
	});

	// Simpan ke globalThis
	globalForMqtt.mqttClient = client;
	return client;
}

// Fungsi publish yang memanggil lazy client
export function publishCommand(
	commandName: string,
	payload: object = {},
): Promise<void> {
	return new Promise((resolve, reject) => {
		const client = getMqttClient(); // Panggil fungsi lazy di sini
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
