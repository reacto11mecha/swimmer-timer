// src/routes/hardware.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Battery,
	BatteryMedium,
	BatteryWarning,
	Cpu,
	Wifi,
	Terminal,
	RefreshCw,
	Signal,
	SignalHigh,
	SignalMedium,
	SignalLow,
} from "lucide-react";

export const Route = createFileRoute("/hardware")({
	component: HardwareTelemetryPage,
});

// Interface untuk Log
interface MqttLog {
	id: number;
	time: string;
	topic: string;
	payload: string;
}

function HardwareTelemetryPage() {
	const [telemetry, setTelemetry] = useState({
		isConnected: false,
		voltage: 0.0,
		percentage: 0,
		uptime: "0s",
		lastPing: "-",
		rssi: -100,
	});

	const [logs, setLogs] = useState<MqttLog[]>([]);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const clientRef = useRef<mqtt.MqttClient | null>(null);

	useEffect(() => {
		// URL Broker WebSocket (Sesuaikan port dengan konfigurasi Mosquitto Anda)
		// Umumnya port 9001 untuk WebSocket tanpa TLS, 1883 untuk TCP biasa
		const wsUrl = import.meta.env.VITE_MQTT_WS_URL || "ws://localhost:9001";

		const client = mqtt.connect(wsUrl, {
			clientId: `web_dashboard_${Math.random().toString(16).slice(2, 8)}`,
			keepalive: 30,
		});

		clientRef.current = client;

		client.on("connect", () => {
			setTelemetry((prev) => ({ ...prev, isConnected: true }));

			// Subscribe ke topik-topik krusial
			client.subscribe("swimtimer/telemetry");
			client.subscribe("swimtimer/evt/#");
			client.subscribe("swimtimer/cmd/#"); // Pantau juga command dari server
		});

		client.on("message", (topic, message) => {
			const payloadString = message.toString();

			// 1. Parsing khusus untuk Telemetri Hardware
			if (topic === "swimtimer/telemetry") {
				try {
					const data = JSON.parse(payloadString);
					setTelemetry((prev) => ({
						...prev,
						voltage: data.v ?? prev.voltage,
						percentage: data.batt ?? prev.percentage,
						uptime: data.uptime ?? prev.uptime,
						// Jika Anda menambahkan logika hitung ping (selisih ms)
						lastPing: data.ping ? `${data.ping}ms` : prev.lastPing,
						rssi: data.rssi ?? prev.rssi,
					}));
				} catch (error) {
					console.error("Gagal parse telemetri:", error);
				}
			}

			// 2. Tambahkan ke Log UI (Batasi maksimal 15 baris terakhir agar tidak memory leak)
			setLogs((prevLogs) => {
				const newLog: MqttLog = {
					id: Date.now(),
					time: new Date().toLocaleTimeString("id-ID", { hour12: false }),
					topic: topic,
					payload: payloadString,
				};
				return [newLog, ...prevLogs].slice(0, 15);
			});
		});

		client.on("offline", () => {
			setTelemetry((prev) => ({ ...prev, isConnected: false }));
		});

		client.on("error", (err) => {
			console.error("MQTT WS Error:", err);
			client.end();
		});

		// Cleanup saat berpindah halaman
		return () => {
			if (clientRef.current) {
				clientRef.current.end();
			}
		};
	}, []);

	const getSignalStatus = (rssi: number) => {
		if (rssi >= -55)
			return {
				icon: <SignalHigh className="w-4 h-4 text-green-500" />,
				text: "Sangat Baik",
				color: "bg-green-500",
			};
		if (rssi >= -70)
			return {
				icon: <SignalMedium className="w-4 h-4 text-blue-500" />,
				text: "Baik",
				color: "bg-blue-500",
			};
		if (rssi >= -85)
			return {
				icon: <SignalLow className="w-4 h-4 text-yellow-500" />,
				text: "Lemah",
				color: "bg-yellow-500",
			};
		return {
			icon: <Signal className="w-4 h-4 text-red-500" />,
			text: "Buruk",
			color: "bg-red-500",
		};
	};

	const handleManualPing = () => {
		if (!clientRef.current || !telemetry.isConnected) return;

		setIsRefreshing(true);
		// Publish payload kosong atau spesifik ke topik ping
		clientRef.current.publish(
			"swimtimer/cmd/ping",
			JSON.stringify({ timestamp: Date.now() }),
		);

		setTimeout(() => setIsRefreshing(false), 500);
	};

	const getBatteryIcon = (percent: number) => {
		if (percent > 70) return <Battery className="w-8 h-8 text-green-500" />;
		if (percent > 20)
			return <BatteryMedium className="w-8 h-8 text-yellow-500" />;
		return <BatteryWarning className="w-8 h-8 text-red-500 animate-pulse" />;
	};

	const getBatteryColor = (percent: number) => {
		if (percent > 70) return "bg-green-500";
		if (percent > 20) return "bg-yellow-500";
		return "bg-red-500";
	};

	return (
		<div className="container mx-auto p-6 max-w-6xl space-y-6">
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Status Perangkat (Live)
					</h1>
					<p className="text-muted-foreground mt-1">
						Terhubung langsung ke ESP32 via MQTT WebSockets.
					</p>
				</div>
				<Button
					variant="outline"
					onClick={handleManualPing}
					disabled={isRefreshing || !telemetry.isConnected}
				>
					<RefreshCw
						className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
					/>
					Ping Perangkat
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Koneksi Broker (WS)
						</CardTitle>
						<Wifi
							className={`h-4 w-4 ${telemetry.isConnected ? "text-green-500" : "text-red-500"}`}
						/>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{telemetry.isConnected ? "Terhubung" : "Terputus"}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Latency: {telemetry.lastPing}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Sinyal Wi-Fi (ESP32)
						</CardTitle>
						{getSignalStatus(telemetry.rssi).icon}
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{telemetry.rssi}{" "}
							<span className="text-sm font-normal text-muted-foreground">
								dBm
							</span>
						</div>
						<div className="flex items-center gap-2 mt-2">
							<div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
								<div
									className={`h-full ${getSignalStatus(telemetry.rssi).color} transition-all duration-500`}
									style={{
										width: `${Math.max(0, 100 - Math.abs(telemetry.rssi + 30))}%`,
									}}
								/>
							</div>
							<span className="text-xs text-muted-foreground font-mono">
								{getSignalStatus(telemetry.rssi).text}
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Daya Baterai (ADC)
						</CardTitle>
						{getBatteryIcon(telemetry.percentage)}
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{telemetry.percentage}%</div>
						<div className="flex items-center gap-2 mt-2">
							<div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
								<div
									className={`h-full ${getBatteryColor(telemetry.percentage)} transition-all duration-500`}
									style={{ width: `${telemetry.percentage}%` }}
								/>
							</div>
							<span className="text-xs text-muted-foreground font-mono">
								{telemetry.voltage}V
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Sistem ESP32
						</CardTitle>
						<Cpu className="h-4 w-4 text-blue-500" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{telemetry.uptime}</div>
						<p className="text-xs text-muted-foreground mt-1">
							Waktu aktif sejak reboot terakhir
						</p>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Terminal className="h-5 w-5" />
						Live Event Logs (15 Pesan Terakhir)
					</CardTitle>
					<CardDescription>
						Menyadap semua komunikasi yang terjadi di topik swimtimer/#
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="rounded-md border bg-slate-50 dark:bg-slate-950 max-h-[400px] overflow-y-auto">
						<Table>
							<TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-950 z-10 shadow-sm">
								<TableRow>
									<TableHead className="w-[100px]">Waktu</TableHead>
									<TableHead className="w-[200px]">Topik</TableHead>
									<TableHead>Payload (JSON)</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{logs.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={3}
											className="text-center text-muted-foreground h-24"
										>
											Belum ada lalu lintas data MQTT...
										</TableCell>
									</TableRow>
								) : (
									logs.map((log) => (
										<TableRow
											key={log.id}
											className="font-mono text-xs hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
										>
											<TableCell className="text-muted-foreground whitespace-nowrap">
												{log.time}
											</TableCell>
											<TableCell>
												<Badge
													variant={
														log.topic.includes("cmd")
															? "default"
															: log.topic.includes("evt")
																? "secondary"
																: "outline"
													}
													className="font-normal rounded-sm"
												>
													{log.topic}
												</Badge>
											</TableCell>
											<TableCell className="text-blue-600 dark:text-blue-400 break-all">
												{log.payload}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
