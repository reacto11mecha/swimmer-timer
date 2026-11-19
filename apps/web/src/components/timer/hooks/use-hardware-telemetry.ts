// components/timer/hooks/use-hardware-telemetry.ts
import { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";

export interface TelemetryState {
	isConnected: boolean;
	currentState: string;
	isMaintenance: boolean;
	rssi: number;
	secondsSinceLastMsg: number | null;
}

export function useHardwareTelemetry() {
	const [telemetry, setTelemetry] = useState<
		Omit<TelemetryState, "secondsSinceLastMsg">
	>({
		isConnected: false,
		currentState: "UNKNOWN",
		isMaintenance: false,
		rssi: -100,
	});

	const [secondsSinceLastMsg, setSecondsSinceLastMsg] = useState<number | null>(
		null,
	);
	const lastReceivedRef = useRef<number | null>(null);

	useEffect(() => {
		const wsUrl =
			import.meta.env.VITE_MQTT_WS_URL ||
			`ws://${window.location.hostname}:9001`;

		const client = mqtt.connect(wsUrl, {
			clientId: `timer_telemetry_${Math.random().toString(16).slice(2, 8)}`,
			keepalive: 30,
		});

		client.on("connect", () => {
			setTelemetry((prev) => ({ ...prev, isConnected: true }));
			client.subscribe("swimtimer/telemetry");
		});

		client.on("message", (topic, message) => {
			if (topic === "swimtimer/telemetry") {
				try {
					const data = JSON.parse(message.toString());
					lastReceivedRef.current = Date.now();
					setSecondsSinceLastMsg(0);

					setTelemetry((prev) => ({
						...prev,
						currentState: data.current_state ?? prev.currentState,
						isMaintenance: Boolean(data.is_maintenance),
						rssi: data.rssi ?? prev.rssi,
					}));
				} catch (error) {
					console.error("Gagal parse telemetri MQTT:", error);
				}
			}
		});

		client.on("offline", () => {
			setTelemetry((prev) => ({ ...prev, isConnected: false }));
		});

		client.on("error", (err) => {
			console.error("MQTT Telemetry WS Error:", err);
			client.end();
		});

		// Interval 100ms untuk menghitung watchdog timer dengan akurasi 1 desimal
		const interval = setInterval(() => {
			if (lastReceivedRef.current !== null) {
				const diffSeconds = (Date.now() - lastReceivedRef.current) / 1000;
				setSecondsSinceLastMsg(diffSeconds);
			}
		}, 100);

		return () => {
			clearInterval(interval);
			client.end();
		};
	}, []);

	return {
		...telemetry,
		secondsSinceLastMsg,
	};
}
