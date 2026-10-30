// apps/web/src/components/timer/hooks/use-timer-mqtt.ts
import { useEffect, useRef } from "react";
import mqtt from "mqtt";
import type { Lane } from "../types";

interface Options {
	lanesRef: React.RefObject<Lane[]>;
	onStart: () => void;
	onLap: (lane: number, elapsedMs: number, athleteName: string) => void;
	onStop: () => void;
	onFinish: () => void;
}

export function useTimerMqtt({
	lanesRef,
	onStart,
	onLap,
	onStop,
	onFinish,
}: Options) {
	// Pakai ref untuk callback supaya koneksi MQTT tidak re-subscribe
	// setiap kali handler berubah karena re-render.
	const callbacksRef = useRef({ onStart, onLap, onStop, onFinish });
	callbacksRef.current = { onStart, onLap, onStop, onFinish };

	useEffect(() => {
		const wsUrl = import.meta.env.VITE_MQTT_WS_URL || "ws://localhost:9001";
		const client = mqtt.connect(wsUrl, {
			clientId: `dashboard_${Math.random().toString(16).slice(2, 8)}`,
		});

		client.on("connect", () => {
			client.subscribe("swimtimer/evt/start");
			client.subscribe("swimtimer/evt/lap");
			client.subscribe("swimtimer/cmd/control");
			client.subscribe("swimtimer/evt/race/finish");
		});

		client.on("message", (topic, message) => {
			try {
				const raw = message.toString();
				const cb = callbacksRef.current;

				if (topic === "swimtimer/evt/start") {
					cb.onStart();
				} else if (topic === "swimtimer/evt/lap") {
					const data = JSON.parse(raw);
					if (data.lane && data.elapsed_ms) {
						const athlete = lanesRef.current.find(
							(l) => l.laneNumber === data.lane,
						);
						const athleteName = athlete?.athleteName || "Peserta";
						cb.onLap(data.lane, data.elapsed_ms, athleteName);
					}
				} else if (topic === "swimtimer/cmd/control") {
					const payload = JSON.parse(raw);
					if (payload.command === "STOP") {
						cb.onStop();
					}
				} else if (topic === "swimtimer/evt/race/finish") {
					cb.onFinish();
				}
			} catch (err) {
				console.warn("Gagal memproses pesan MQTT:", err);
			}
		});

		return () => {
			client.end();
		};
	}, [lanesRef]);
}
