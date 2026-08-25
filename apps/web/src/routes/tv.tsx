import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import mqtt from "mqtt";
import { getLiveDashboard } from "@/server/timer.functions";
import { Maximize, Minimize } from "lucide-react";

export const Route = createFileRoute("/tv")({
	component: TvDisplayPage,
});

function TvDisplayPage() {
	const requestRef = useRef<number | null>(null);
	const clientRef = useRef<mqtt.MqttClient | null>(null);

	const [displayTime, setDisplayTime] = useState(0);
	const [localStartTime, setLocalStartTime] = useState<number | null>(null);
	const [raceState, setRaceState] = useState<
		"READY" | "RUNNING" | "STOPPED" | "FINISHED"
	>("READY");
	const [laneData, setLaneData] = useState<Record<number, number[]>>({});
	const [isFullscreen, setIsFullscreen] = useState(false);

	const { data: dashboard } = useQuery({
		queryKey: ["liveTimer"],
		queryFn: () => getLiveDashboard(),
		refetchInterval: 5000,
	});

	const lanesRef = useRef(dashboard?.lanes || []);
	useEffect(() => {
		if (dashboard?.lanes) lanesRef.current = dashboard.lanes;
	}, [dashboard?.lanes]);

	// 1. Sinkronisasi Data Awal
	useEffect(() => {
		if (dashboard?.heat) {
			const heat = dashboard.heat;
			const startMs = heat.startedAt
				? new Date(heat.startedAt).getTime()
				: null;
			const restoredLaneData: Record<number, number[]> = {};

			dashboard.lanes.forEach((lane) => {
				if (lane.laps && lane.laps.length > 0) {
					restoredLaneData[lane.laneNumber] = lane.laps.map((l) => l.rawMillis);
				}
			});

			if (heat.status === "RUNNING") {
				setRaceState("RUNNING");
				if (startMs) setLocalStartTime(startMs);
			} else if (heat.status === "FINISHED" || heat.status === "STOPPED") {
				setRaceState(heat.status as "FINISHED" | "STOPPED");
			} else {
				setRaceState("READY");
				setLocalStartTime(null);
				setDisplayTime(0);
			}
			setLaneData(restoredLaneData);
		}
	}, [dashboard?.heat?.id]);

	// 2. Koneksi MQTT untuk Data Realtime
	useEffect(() => {
		const wsUrl = import.meta.env.VITE_MQTT_WS_URL || "ws://localhost:9001";
		const client = mqtt.connect(wsUrl, {
			clientId: `tv_display_${Math.random().toString(16).slice(2, 8)}`,
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
				} else if (topic === "swimtimer/evt/lap") {
					const data = JSON.parse(raw);
					if (data.lane && data.elapsed_ms) {
						setLaneData((prev) => {
							const currentLaps = prev[data.lane] || [];
							return {
								...prev,
								[data.lane]: [...currentLaps, data.elapsed_ms],
							};
						});
					}
				} else if (topic === "swimtimer/cmd/control") {
					const payload = JSON.parse(raw);
					if (payload.command === "STOP") setRaceState("STOPPED");
					if (payload.command === "RESET") {
						setRaceState("READY");
						setLocalStartTime(null);
						setDisplayTime(0);
						setLaneData({});
					}
				} else if (topic === "swimtimer/evt/race/finish") {
					setRaceState("FINISHED");
				}
			} catch (err) {
				// Abaikan error parsing agar layar TV tidak terganggu
			}
		});

		return () => {
			client.end();
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		};
	}, []);

	// 3. Animasi Stopwatch Layar Lebar
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

	// Fungsi Toggle Fullscreen API HTML5
	const toggleFullscreen = () => {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen().catch((err) => {
				console.error(`Error attempting to enable fullscreen: ${err.message}`);
			});
			setIsFullscreen(true);
		} else {
			document.exitFullscreen();
			setIsFullscreen(false);
		}
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

	if (!dashboard || !dashboard.heat) {
		return (
			<div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center text-slate-500">
				<h1 className="text-6xl font-bold mb-4 tracking-tight">KOLAM KOSONG</h1>
				<p className="text-2xl">Belum ada seri yang diaktifkan.</p>
				<button
					onClick={toggleFullscreen}
					className="absolute bottom-6 right-6 p-4 bg-slate-800 rounded-full hover:bg-slate-700 transition"
				>
					{isFullscreen ? (
						<Minimize className="w-8 h-8 text-white" />
					) : (
						<Maximize className="w-8 h-8 text-white" />
					)}
				</button>
			</div>
		);
	}

	const { heat, event, lanes } = dashboard;

	return (
		<div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col overflow-hidden font-sans select-none">
			{/* TOMBOL FULLSCREEN TERSEMBUNYI (Pojok Kanan Atas) */}
			<button
				onClick={toggleFullscreen}
				className="absolute top-6 right-6 p-3 bg-slate-800/50 hover:bg-slate-800 rounded-full transition opacity-20 hover:opacity-100 z-50"
			>
				{isFullscreen ? (
					<Minimize className="w-6 h-6 text-white" />
				) : (
					<Maximize className="w-6 h-6 text-white" />
				)}
			</button>

			{/* HEADER TV */}
			<div className="flex items-center justify-between px-10 py-6 bg-slate-900 border-b border-slate-800 shadow-2xl">
				<div className="flex flex-col">
					<div className="flex items-center gap-4 mb-2">
						<span
							className={`px-4 py-1 text-lg font-bold rounded-full uppercase tracking-wider ${
								raceState === "RUNNING"
									? "bg-blue-600 text-white"
									: raceState === "FINISHED"
										? "bg-green-600 text-white"
										: "bg-yellow-500 text-black"
							}`}
						>
							{raceState === "READY" ? "WAITING" : raceState}
						</span>
						<span className="text-2xl font-semibold text-slate-400">
							HEAT {heat.label}
						</span>
					</div>
					<h1 className="text-5xl font-bold tracking-tight text-slate-100">
						{event?.eventName}
					</h1>
					<h2 className="text-3xl font-medium text-slate-400 mt-2">
						{event?.distanceStyle} ({event?.gender}) — {event?.ageGroup}
					</h2>
				</div>

				{/* WAKTU GLOBAL SUPER BESAR */}
				<div className="flex flex-col items-end">
					<span className="text-xl font-bold text-slate-500 tracking-widest uppercase mb-1">
						Waktu Resmi
					</span>
					<div
						className={`text-[7rem] leading-none font-mono font-bold tabular-nums tracking-tighter ${
							raceState === "RUNNING" ? "text-green-400" : "text-slate-100"
						}`}
					>
						{formatTime(displayTime)}
					</div>
				</div>
			</div>

			{/* BODY / LEADERBOARD LINTASAN */}
			<div className="flex-1 flex flex-col p-6 gap-3 overflow-hidden bg-slate-950">
				{(() => {
					// --- LOGIKA PERINGKAT (RANKING) ---
					// 1. Kumpulkan semua lintasan yang sudah selesai (hwLaps.length >= heat.maxLaps)
					// 2. Ambil waktu finalnya, lalu urutkan dari yang tercepat ke terlambat
					const finishedLanes = lanes
						.map((lane) => {
							const hwLaps = laneData[lane.laneNumber] || [];
							const isFinished = hwLaps.length >= heat.maxLaps;
							// Jika sudah selesai, gunakan waktu lap terakhir. Jika belum, set Infinity.
							const finalTime = isFinished
								? hwLaps[heat.maxLaps - 1]
								: Infinity;
							return { laneNumber: lane.laneNumber, isFinished, finalTime };
						})
						.filter((l) => l.isFinished)
						.sort((a, b) => a.finalTime - b.finalTime);

					return lanes.map((lane) => {
						const hwLaps = laneData[lane.laneNumber] || [];
						const lastLapMs = hwLaps.length > 0 ? hwLaps[hwLaps.length - 1] : 0;
						const isFinished = hwLaps.length >= heat.maxLaps;

						// Cari peringkat atlet ini di dalam array yang sudah diurutkan tadi
						const rankIndex = finishedLanes.findIndex(
							(l) => l.laneNumber === lane.laneNumber,
						);
						const rank = rankIndex !== -1 ? rankIndex + 1 : null;

						return (
							<div
								key={lane.id}
								className={`flex-1 flex items-center bg-slate-900 rounded-2xl border-l-[12px] pr-8 transition-colors duration-300 ${
									isFinished
										? "border-yellow-500 bg-slate-800/80"
										: "border-slate-700"
								}`}
							>
								{/* NOMOR LINTASAN */}
								<div className="w-24 flex items-center justify-center h-full bg-slate-800/50 rounded-r-xl">
									<span className="text-5xl font-bold text-slate-300">
										{lane.laneNumber}
									</span>
								</div>

								{/* NAMA ATLET & KLUB */}
								<div className="flex-1 flex flex-col justify-center px-8">
									<span className="text-4xl font-bold text-slate-100 truncate pb-1">
										{lane.athleteName || "KOSONG"}
									</span>
									<span className="text-2xl text-slate-400 truncate font-medium">
										{lane.clubName || "-"}
									</span>
								</div>

								{/* --- KOTAK PERINGKAT (Sesuai Permintaan Client) --- */}
								<div className="w-24 flex items-center justify-center shrink-0">
									{rank && (
										<div className="bg-yellow-500 text-slate-950 text-4xl font-black w-16 h-16 flex items-center justify-center rounded-2xl shadow-lg border-b-4 border-yellow-700 animate-in zoom-in spin-in-12 duration-500">
											{rank}
										</div>
									)}
								</div>
								{/* -------------------------------------------------- */}

								{/* STATUS LAP & WAKTU */}
								<div className="flex items-center gap-8 ml-4">
									{isFinished && (
										<span className="text-2xl font-bold text-yellow-500 tracking-widest uppercase bg-yellow-500/10 px-4 py-2 rounded-lg">
											FINISH
										</span>
									)}

									{hwLaps.length > 0 && !isFinished && (
										<span className="text-2xl font-bold text-blue-400 tracking-widest uppercase bg-blue-400/10 px-4 py-2 rounded-lg">
											LAP {hwLaps.length}
										</span>
									)}

									<div className="w-[320px] text-right">
										<span
											className={`text-6xl font-mono font-bold tabular-nums tracking-tighter ${
												isFinished ? "text-yellow-500" : "text-slate-100"
											}`}
										>
											{isFinished ||
											raceState === "STOPPED" ||
											raceState === "FINISHED"
												? formatTime(lastLapMs)
												: hwLaps.length > 0
													? formatTime(lastLapMs)
													: "- : - . -"}
										</span>
									</div>
								</div>
							</div>
						);
					});
				})()}
			</div>
		</div>
	);
}
