// apps/web/src/components/main-timer.tsx
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import mqtt from "mqtt";

import { getLiveDashboard } from "@/server/timer.functions";
import {
	activateNextHeat,
	getPendingHeats,
	activateHeat,
} from "@/server/heat.functions";
import { printHeatResult } from "@/server/print.functions";
import { triggerStopHardware } from "@/server/mqtt.functions";
import { resetCurrentHeat } from "@/server/heat.functions";
import {
	submitHeatResultsToSpeedzone,
	refreshHeatLanesFromSpeedzone,
} from "@/server/speedzone.functions"; // Tambahkan fungsi Speedzone

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Timer,
	Activity,
	RotateCcw,
	History,
	AlertTriangle,
	ArrowRight,
	Printer,
	CloudUpload,
	Search,
	RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface ActivityLog {
	id: string;
	time: string;
	message: string;
	type: "info" | "success" | "warning" | "destructive";
}

export default function TimerDashboard() {
	const requestRef = useRef<number | null>(null);
	const clientRef = useRef<mqtt.MqttClient | null>(null);

	const [displayTime, setDisplayTime] = useState(0);
	const [localStartTime, setLocalStartTime] = useState<number | null>(null);
	const [raceState, setRaceState] = useState<
		"READY" | "RUNNING" | "STOPPED" | "FINISHED"
	>("READY");

	const [laneData, setLaneData] = useState<Record<number, number[]>>({});
	const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
	const [initializedHeatId, setInitializedHeatId] = useState<number | null>(
		null,
	);

	const queryClient = useQueryClient(); // Pastikan Anda mengimpor useQueryClient dari @tanstack/react-query di awal file

	const { data: dashboard, isLoading } = useQuery({
		queryKey: ["liveTimer"],
		queryFn: () => getLiveDashboard(),
		refetchInterval: 5000,
	});

	const lanesRef = useRef(dashboard?.lanes || []);
	useEffect(() => {
		if (dashboard?.lanes) lanesRef.current = dashboard.lanes;
	}, [dashboard?.lanes]);

	const addLog = (
		msg: string,
		type: ActivityLog["type"] = "info",
		customTime?: string,
	) => {
		setActivityLogs((prev) =>
			[
				{
					id: Math.random().toString(36).substr(2, 9),
					time:
						customTime ||
						new Date().toLocaleTimeString("id-ID", { hour12: false }),
					message: msg,
					type,
				},
				...prev,
			].slice(0, 50),
		);
	};

	// 1. SINKRONISASI INITIAL STATE & REKONSTRUKSI LOG HISTORIS
	useEffect(() => {
		if (dashboard?.heat && dashboard.heat.id !== initializedHeatId) {
			const heat = dashboard.heat;
			const startMs = heat.startedAt
				? new Date(heat.startedAt).getTime()
				: null;

			const historicalLogs: ActivityLog[] = [];
			const restoredLaneData: Record<number, number[]> = {};
			const allLaps: any[] = [];

			if (startMs) {
				historicalLogs.push({
					id: "hist_start",
					time: new Date(startMs).toLocaleTimeString("id-ID", {
						hour12: false,
					}),
					message: "Pistol ditembakkan! Perlombaan dimulai.",
					type: "success",
				});
			}

			dashboard.lanes.forEach((lane) => {
				if (lane.laps && lane.laps.length > 0) {
					restoredLaneData[lane.laneNumber] = lane.laps.map((l) => l.rawMillis);

					lane.laps.forEach((lap) => {
						allLaps.push({
							athlete: lane.athleteName || "Peserta",
							laneNum: lane.laneNumber,
							lapNum: lap.lapNumber,
							ms: lap.rawMillis,
							isFinish: lap.lapNumber >= heat.maxLaps,
						});
					});
				}
			});

			allLaps.sort((a, b) => a.ms - b.ms);
			allLaps.forEach((lap, idx) => {
				const logTime = startMs
					? new Date(startMs + lap.ms).toLocaleTimeString("id-ID", {
							hour12: false,
						})
					: "-";

				historicalLogs.push({
					id: `hist_lap_${idx}`,
					time: logTime,
					message: lap.isFinish
						? `${lap.athlete} (Lintasan ${lap.laneNum}) FINISH dengan waktu ${formatTime(lap.ms)}!`
						: `${lap.athlete} (Lintasan ${lap.laneNum}) menyentuh dinding untuk Lap ${lap.lapNum}.`,
					type: lap.isFinish ? "success" : "info",
				});
			});

			if (heat.status === "RUNNING") {
				setRaceState("RUNNING");
				if (startMs) setLocalStartTime(startMs);
			} else if (heat.status === "FINISHED" || heat.status === "STOPPED") {
				setRaceState(heat.status as "FINISHED" | "STOPPED");
				historicalLogs.push({
					id: "hist_end",
					time: "-",
					message: `Perlombaan berstatus ${heat.status}.`,
					type: "warning",
				});
			} else {
				setRaceState("READY");
				setLocalStartTime(null);
				setDisplayTime(0);
			}

			setActivityLogs(historicalLogs.reverse());
			setLaneData(restoredLaneData);
			setInitializedHeatId(heat.id);
		}
	}, [dashboard?.heat?.id, initializedHeatId]);

	// 2. SETUP MQTT WEBSOCKET (DENGAN TOPIK YANG DISESUAIKAN)
	useEffect(() => {
		const wsUrl = import.meta.env.VITE_MQTT_WS_URL || "ws://localhost:9001";
		const client = mqtt.connect(wsUrl, {
			clientId: `dashboard_${Math.random().toString(16).slice(2, 8)}`,
		});
		clientRef.current = client;

		client.on("connect", () => {
			client.subscribe("swimtimer/evt/start");
			client.subscribe("swimtimer/evt/lap");
			client.subscribe("swimtimer/cmd/control");
			client.subscribe("swimtimer/evt/race/finish");
		});

		client.on("message", (topic, message) => {
			try {
				const raw = message.toString();

				if (topic === "swimtimer/evt/start") {
					setRaceState("RUNNING");
					setLocalStartTime(Date.now());
					setLaneData({});
					setActivityLogs([]);
					addLog("Pistol ditembakkan! Perlombaan dimulai.", "success");
				} else if (topic === "swimtimer/evt/lap") {
					const data = JSON.parse(raw);
					if (data.lane && data.elapsed_ms) {
						const athlete = lanesRef.current.find(
							(l) => l.laneNumber === data.lane,
						);
						const athleteName = athlete?.athleteName || "Peserta";

						setLaneData((prev) => {
							const currentLaps = prev[data.lane] || [];
							const lapOrder = currentLaps.length + 1;
							const isFinish =
								dashboard?.heat && lapOrder >= dashboard.heat.maxLaps;

							if (isFinish) {
								addLog(
									`${athleteName} (Lintasan ${data.lane}) FINISH dengan waktu ${formatTime(data.elapsed_ms)}!`,
									"success",
								);
							} else {
								addLog(
									`${athleteName} (Lintasan ${data.lane}) menyentuh dinding untuk Lap ${lapOrder}.`,
									"info",
								);
							}

							return {
								...prev,
								[data.lane]: [...currentLaps, data.elapsed_ms],
							};
						});
					}
				} else if (topic === "swimtimer/cmd/control") {
					const payload = JSON.parse(raw);
					if (payload.command === "STOP") {
						setRaceState("STOPPED");
						addLog(
							"Perlombaan dihentikan secara paksa (FORCE STOP).",
							"destructive",
						);
					}
					// Abaikan command RESET karena tidak memengaruhi UI
				} else if (topic === "swimtimer/evt/race/finish") {
					setRaceState("FINISHED");
					addLog(
						"🏁 Semua perenang telah menyelesaikan perlombaan!",
						"success",
					);

					// Kita butuh ID heat yang aktif untuk dicetak
					if (dashboard?.heat) {
						addLog("Mencetak struk hasil otomatis...", "info");
						printMutation.mutate(dashboard.heat.id);
					}
				}
			} catch (err) {
				console.warn("Gagal memproses pesan MQTT:", err);
			}
		});

		return () => {
			client.end();
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		};
	}, [dashboard?.heat?.maxLaps]);

	// 3. ANIMASI STOPWATCH
	useEffect(() => {
		if (raceState === "RUNNING" && localStartTime) {
			const update = () => {
				setDisplayTime(Date.now() - localStartTime);
				requestRef.current = requestAnimationFrame(update);
			};
			requestRef.current = requestAnimationFrame(update);
		} else {
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
			if (raceState === "READY") setDisplayTime(0);
		}
		return () => {
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		};
	}, [raceState, localStartTime]);

	// 4. MUTASI & LOGIKA UX TOMBOL AKSI
	const resetMutation = useMutation({
		mutationFn: (heatId: number) => resetCurrentHeat({ data: { heatId } }),
		onSuccess: (res) => {
			setRaceState("READY");
			setLocalStartTime(null);
			setDisplayTime(0);
			setLaneData({});
			setActivityLogs([]);
			addLog(res.message, "info");

			// Wajib invalidate agar React Query menarik ulang data bersih dari database
			queryClient.invalidateQueries({ queryKey: ["liveTimer"] });
			toast.success("Heat beserta hardware telah direset.");
		},
		onError: (err: any) => {
			toast.error(`Gagal mereset: ${err.message}`);
		},
	});

	const stopMutation = useMutation({
		mutationFn: () => triggerStopHardware(),
		onSuccess: () => {
			addLog("Mengirim sinyal FORCE STOP ke perangkat keras...", "warning");
		},
	});
	const nextHeatMutation = useMutation({
		mutationFn: () => activateNextHeat(),
		onSuccess: (res) => {
			// Reset state lokal
			setRaceState("READY");
			setLocalStartTime(null);
			setDisplayTime(0);
			setLaneData({});
			setActivityLogs([]);
			addLog(res.message, "success");
		},
		onError: (err: any) => {
			alert(err.message);
		},
	});
	const printMutation = useMutation({
		mutationFn: (heatId: number) => printHeatResult({ data: { heatId } }),
		onSuccess: (res) => {
			addLog(res.message as string, "success");
			toast.success(res.message as string);
		},
		onError: (err: any) => {
			addLog(`Gagal Print: ${err.message}`, "destructive");
			toast.error(err.message);
		},
	});

	const handleForceStop = () => {
		if (
			window.confirm(
				"⚠️ PERINGATAN KELAS BERAT ⚠️\n\nApakah Anda yakin ingin MENGHENTIKAN PAKSA alat?\nWaktu detik akan berhenti dan perlombaan ini dianggap selesai/batal.",
			)
		) {
			stopMutation.mutate();
		}
	};

	const handleResetHardware = () => {
		if (!dashboard?.heat) return;

		if (
			window.confirm(
				"⚠️ PERINGATAN: RESET TOTAL ⚠️\n\nApakah Anda yakin ingin mereset KESELURUHAN heat ini?\nSeluruh data putaran dan waktu yang terekam akan dihapus dari server, perlombaan ini akan dikembalikan ke status PENDING, dan hardware akan di-reset ke angka 0.",
			)
		) {
			resetMutation.mutate(dashboard.heat.id);
		}
	};

	// --- 1. Query untuk mengambil daftar Heat yang masih PENDING ---
	const { data: pendingHeats } = useQuery({
		queryKey: ["pendingHeats"],
		queryFn: () => getPendingHeats(),
	});

	// --- 2. Mutasi untuk melompat ke seri tertentu ---
	const jumpToHeatMutation = useMutation({
		mutationFn: (heatId: number) =>
			activateHeat({ data: { heatDbId: heatId } }),
		onSuccess: (res) => {
			setRaceState("READY");
			setLocalStartTime(null);
			setDisplayTime(0);
			setLaneData({});
			setActivityLogs([]);
			addLog(`Berhasil melompat ke seri.`, "success");
			queryClient.invalidateQueries({ queryKey: ["liveTimer"] });
			queryClient.invalidateQueries({ queryKey: ["pendingHeats"] });
			toast.success("Berhasil pindah seri!");
		},
		onError: (err: any) => toast.error(err.message),
	});

	// --- 3. Mutasi untuk menarik data lane terbaru dari Speedzone ---
	const refreshLanesMutation = useMutation({
		mutationFn: (eventId: number) =>
			refreshHeatLanesFromSpeedzone({ data: { eventId } }),
		onSuccess: () => {
			addLog("Data lintasan berhasil diperbarui dari peladen pusat.", "info");
			queryClient.invalidateQueries({ queryKey: ["liveTimer"] });
			toast.success("Data peserta diperbarui!");
		},
		onError: (err: any) =>
			toast.error(`Gagal memperbarui data: ${err.message}`),
	});

	// --- 4. Mutasi untuk sinkronisasi hasil ke Speedzone ---
	const syncToSpeedzoneMutation = useMutation({
		mutationFn: (payload: any) =>
			submitHeatResultsToSpeedzone({ data: payload }),
		onSuccess: () => {
			addLog("Hasil perlombaan berhasil disinkronkan ke Cloud!", "success");
			toast.success("Catatan waktu berhasil disinkronkan!");
		},
		onError: (err: any) => {
			addLog(`Gagal sinkronisasi: ${err.message}`, "destructive");
			toast.error(`Gagal sinkronisasi: ${err.message}`);
		},
	});

	const handleCloudSync = () => {
		if (!dashboard?.event?.serverEventId || !dashboard?.heat) {
			toast.error("Data event server tidak ditemukan!");
			return;
		}

		const lanesPayload = dashboard.lanes
			.filter((lane) => lane.serverParticipantId)
			.map((lane) => {
				const hwLaps = laneData[lane.laneNumber] || [];
				const isFinished = hwLaps.length >= dashboard.heat!.maxLaps;

				let finalStatus = (lane.status || "OK").toUpperCase();
				if (finalStatus === "OK" && !isFinished) {
					finalStatus = "DNS";
				}

				const finalTimeStr = isFinished
					? formatTime(hwLaps[hwLaps.length - 1])
					: null;

				return {
					heat_lane_id: lane.serverParticipantId,
					result_time: finalTimeStr,
					result_status: finalStatus.toLowerCase() as "ok" | "dq" | "dns",
				};
			});

		toast.info("Mengemas data untuk sinkronisasi...");
		syncToSpeedzoneMutation.mutate({
			serverEventId: dashboard.event.serverEventId,
			heatIds: [dashboard.heat.id],
			lanes: lanesPayload,
		});
	};

	const formatTime = (ms: number) => {
		if (ms < 0) ms = 0;
		const m = Math.floor(ms / 60000)
			.toString()
			.padStart(2, "0");
		const s = Math.floor((ms % 60000) / 1000)
			.toString()
			.padStart(2, "0");
		const mil = Math.floor((ms % 1000) / 10)
			.toString()
			.padStart(2, "0");
		return `${m}:${s}.${mil}`;
	};

	if (isLoading)
		return (
			<div className="flex h-[50vh] items-center justify-center animate-pulse">
				Memuat data kolam...
			</div>
		);
	if (!dashboard || !dashboard.heat)
		return (
			<div className="flex h-[50vh] items-center justify-center text-slate-500">
				Kolam Kosong
			</div>
		);

	const heat = dashboard.heat;
	const event = dashboard.event;
	const nextHeat = dashboard.nextHeat;

	return (
		<div className="p-6 max-w-7xl mx-auto space-y-6 min-h-screen">
			{/* HEADER STOPWATCH */}
			<Card
				className={`border-t-4 shadow-sm transition-colors duration-300 ${raceState === "RUNNING" ? "border-t-green-500" : raceState === "STOPPED" || raceState === "FINISHED" ? "border-t-yellow-500" : "border-t-blue-600"}`}
			>
				<CardHeader className="flex flex-col md:flex-row md:items-start justify-between pb-4 gap-4">
					<div className="flex-1">
						<div className="flex items-center gap-2 mb-2">
							<Badge
								variant={raceState === "RUNNING" ? "default" : "secondary"}
							>
								{raceState === "READY" ? "WAITING GUN START" : raceState}
							</Badge>
							{raceState === "RUNNING" && (
								<Activity className="h-4 w-4 text-green-500 animate-pulse" />
							)}
						</div>
						<CardTitle className="text-3xl font-bold tracking-tight">
							{event?.eventName} - {event?.distanceStyle} ({event?.gender})
						</CardTitle>
						<p className="text-muted-foreground font-medium mt-1">
							Heat {heat.label} • Target: {heat.maxLaps} Lap
						</p>
					</div>

					<div className="text-right flex flex-col items-end gap-3 min-w-[280px]">
						<div>
							<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
								Waktu Resmi
							</p>
							<div
								className={`text-6xl font-mono font-bold tabular-nums tracking-tighter ${raceState === "RUNNING" ? "text-green-600 dark:text-green-400" : ""}`}
							>
								{formatTime(displayTime)}
							</div>
						</div>

						<div className="flex flex-col w-full gap-2 mt-2">
							{/* Menu Lompat Seri */}
							{raceState !== "RUNNING" &&
								pendingHeats &&
								pendingHeats.length > 0 && (
									<div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 rounded-md p-1 border">
										<Search className="w-4 h-4 text-muted-foreground ml-2" />
										<Select
											onValueChange={(val) =>
												jumpToHeatMutation.mutate(Number(val))
											}
											disabled={
												jumpToHeatMutation.isPending || raceState === "RUNNING"
											}
										>
											<SelectTrigger className="w-full h-8 text-sm border-0 bg-transparent focus:ring-0 shadow-none">
												<SelectValue placeholder="Lompat ke Seri..." />
											</SelectTrigger>
											<SelectContent>
												{pendingHeats.map((ph: any) => (
													<SelectItem key={ph.id} value={ph.id.toString()}>
														Heat {ph.label} ({ph.event?.eventName})
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}

							{/* Refresh Data Lintasan */}
							<Button
								variant="outline"
								size="sm"
								className="h-8 text-xs w-full justify-start text-blue-600 hover:text-blue-700"
								disabled={
									refreshLanesMutation.isPending ||
									raceState === "RUNNING" ||
									!dashboard?.event?.serverEventId
								}
								onClick={() =>
									dashboard?.event?.serverEventId &&
									refreshLanesMutation.mutate(dashboard.event.serverEventId)
								}
							>
								<RefreshCw
									className={`w-3 h-3 mr-2 ${refreshLanesMutation.isPending ? "animate-spin" : ""}`}
								/>
								{refreshLanesMutation.isPending
									? "Menarik data..."
									: "Tarik Data Lintasan Baru"}
							</Button>

							{/* Sinkronisasi Cloud */}
							{(raceState === "FINISHED" || raceState === "STOPPED") && (
								<Button
									variant="default"
									size="sm"
									className="h-8 text-xs w-full justify-start bg-blue-600 hover:bg-blue-700 text-white"
									onClick={handleCloudSync}
									disabled={syncToSpeedzoneMutation.isPending}
								>
									<CloudUpload
										className={`w-3 h-3 mr-2 ${syncToSpeedzoneMutation.isPending ? "animate-bounce" : ""}`}
									/>
									{syncToSpeedzoneMutation.isPending
										? "Mengunggah..."
										: "Simpan Hasil ke Cloud"}
								</Button>
							)}
						</div>
					</div>
				</CardHeader>

				<CardContent className="flex flex-wrap gap-3 pt-4 border-t bg-slate-50/50 dark:bg-slate-900/20">
					<Button
						size="lg"
						variant="secondary"
						className="w-48"
						onClick={handleResetHardware}
						disabled={
							raceState === "RUNNING" ||
							raceState === "FINISHED" ||
							resetMutation.isPending
						}
					>
						<RotateCcw className="mr-2 h-5 w-5" />
						{resetMutation.isPending ? "Mereset..." : "Reset Seri"}
					</Button>

					<Button
						size="lg"
						variant="destructive"
						className="w-48"
						disabled={raceState !== "RUNNING" || stopMutation.isPending}
						onClick={handleForceStop}
					>
						<AlertTriangle className="mr-2 h-5 w-5" />
						{stopMutation.isPending ? "Menghentikan..." : "Force Stop"}
					</Button>

					<Button
						size="lg"
						variant="outline"
						className="w-48 bg-white dark:bg-slate-950"
						disabled={
							(raceState !== "FINISHED" && raceState !== "STOPPED") ||
							printMutation.isPending ||
							!dashboard?.heat
						}
						onClick={() =>
							dashboard?.heat && printMutation.mutate(dashboard.heat.id)
						}
					>
						<Printer className="mr-2 h-5 w-5" />
						{printMutation.isPending ? "Mencetak..." : "Print Struk"}
					</Button>

					<div className="flex-1"></div>

					<Button
						size="lg"
						className={`transition-all duration-500 ${
							raceState === "FINISHED" && nextHeat
								? "bg-green-600 hover:bg-green-700 animate-pulse text-white shadow-lg shadow-green-500/30"
								: ""
						}`}
						disabled={
							raceState === "RUNNING" || nextHeatMutation.isPending || !nextHeat
						}
						onClick={() => nextHeatMutation.mutate()}
					>
						{nextHeatMutation.isPending ? (
							"Memuat..."
						) : nextHeat ? (
							<>
								Lanjut: {nextHeat.eventName} Heat {nextHeat.label}
								<ArrowRight className="ml-2 h-5 w-5 shrink-0" />
							</>
						) : (
							"Tidak Ada Seri Lanjutan"
						)}
					</Button>
				</CardContent>
			</Card>

			{/* GRID LINTASAN */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{dashboard.lanes.map((lane) => {
					const hwLaps = laneData[lane.laneNumber] || [];
					const lastLapMs = hwLaps.length > 0 ? hwLaps[hwLaps.length - 1] : 0;
					const isFinished = hwLaps.length >= heat.maxLaps;

					return (
						<Card
							key={lane.id}
							className={`overflow-hidden shadow-sm border-2 ${isFinished ? "border-yellow-400 dark:border-yellow-600" : "border-transparent"}`}
						>
							<div
								className={`p-2 text-center text-white font-bold text-sm flex justify-between px-4 ${isFinished ? "bg-yellow-500" : raceState === "RUNNING" ? "bg-blue-600" : "bg-slate-700"}`}
							>
								<span>LINTASAN {lane.laneNumber}</span>
								{isFinished && (
									<Badge
										variant="secondary"
										className="bg-white/20 border-none text-[10px]"
									>
										FINISH
									</Badge>
								)}
							</div>

							<CardContent className="p-4 space-y-3">
								<div>
									<p className="text-sm font-bold leading-tight uppercase line-clamp-1">
										{lane.athleteName || "KOSONG"}
									</p>
									<p className="text-xs text-muted-foreground truncate font-medium">
										{lane.clubName || "-"}
									</p>
								</div>

								<div
									className={`p-3 rounded-lg flex items-center justify-between border ${isFinished ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900" : "bg-slate-900 text-white dark:bg-black border-slate-800"}`}
								>
									<Timer
										className={`h-5 w-5 ${raceState === "RUNNING" && !isFinished ? "text-blue-400 animate-pulse" : isFinished ? "text-yellow-600 dark:text-yellow-400" : "opacity-50"}`}
									/>
									<span
										className={`font-mono text-2xl font-bold tracking-wider ${isFinished ? "text-yellow-700 dark:text-yellow-400" : ""}`}
									>
										{isFinished ||
										raceState === "STOPPED" ||
										raceState === "FINISHED"
											? formatTime(lastLapMs)
											: formatTime(displayTime)}
									</span>
								</div>

								{hwLaps.length > 0 && (
									<div className="pt-2 border-t border-slate-100 dark:border-slate-800">
										<p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">
											Riwayat Putaran
										</p>
										<div className="space-y-1">
											{hwLaps.map((lapMs, idx) => (
												<div
													key={idx}
													className="flex justify-between items-center text-xs bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded"
												>
													<span className="text-muted-foreground">
														Lap {idx + 1}
													</span>
													<span className="font-mono font-semibold">
														{formatTime(lapMs)}
													</span>
												</div>
											))}
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* TABEL LOG AKTIVITAS */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-lg flex items-center gap-2">
						<History className="h-5 w-5" /> Log Aktivitas Lomba
					</CardTitle>
					<CardDescription>
						Catatan sinkronisasi sensor dan riwayat perlombaan.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="rounded-md border max-h-[300px] overflow-y-auto bg-slate-50 dark:bg-slate-950">
						<Table>
							<TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-950 shadow-sm z-10">
								<TableRow>
									<TableHead className="w-[100px]">Waktu</TableHead>
									<TableHead>Aktivitas</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{activityLogs.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={2}
											className="text-center text-muted-foreground h-16"
										>
											Menunggu perlombaan dimulai...
										</TableCell>
									</TableRow>
								) : (
									activityLogs.map((log) => (
										<TableRow key={log.id}>
											<TableCell className="font-mono text-xs text-muted-foreground align-top">
												{log.time}
											</TableCell>
											<TableCell>
												<span
													className={`text-sm font-medium ${
														log.type === "success"
															? "text-green-600 dark:text-green-400"
															: log.type === "destructive"
																? "text-red-600 dark:text-red-400"
																: log.type === "warning"
																	? "text-yellow-600 dark:text-yellow-500"
																	: "text-slate-700 dark:text-slate-300"
													}`}
												>
													{log.message}
												</span>
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
