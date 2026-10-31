// apps/web/src/components/main-timer.tsx
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getLiveDashboard } from "@/server/timer.functions";
import { getPendingHeats } from "@/server/heat.functions";

import type { ActivityLog, RaceState } from "./timer/types";
import { createLog, formatTime } from "./timer/utils";
import { useTimerAnimation } from "./timer/hooks/use-timer-animation";
import { useTimerMqtt } from "./timer/hooks/use-timer-mqtt";
import { useHeatSync } from "./timer/hooks/use-heat-sync";
import { useTimerMutations } from "./timer/hooks/use-timer-mutations";
import { TimerHeader } from "./timer/components/timer-header";
import { LaneGrid } from "./timer/components/lane-grid";
import { ActivityLogTable } from "./timer/components/activity-log-table";

export default function TimerDashboard() {
	const queryClient = useQueryClient();

	// --- STATE ---
	const [localStartTime, setLocalStartTime] = useState<number | null>(null);
	const [raceState, setRaceState] = useState<RaceState>("READY");
	const [laneData, setLaneData] = useState<Record<number, number[]>>({});
	const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
	const [initializedHeatId, setInitializedHeatId] = useState<number | null>(
		null,
	);

	// --- QUERIES ---
	const { data: dashboard, isLoading } = useQuery({
		queryKey: ["liveTimer"],
		queryFn: () => getLiveDashboard(),
		refetchInterval: 5000,
	});

	const { data: pendingHeats } = useQuery({
		queryKey: ["pendingHeats"],
		queryFn: () => getPendingHeats(),
	});

	// --- REFS (untuk data segar di dalam callback MQTT) ---
	const lanesRef = useRef<any[]>(dashboard?.lanes || []);
	useEffect(() => {
		if (dashboard?.lanes) lanesRef.current = dashboard.lanes;
	}, [dashboard?.lanes]);

	const dashboardRef = useRef(dashboard);
	useEffect(() => {
		dashboardRef.current = dashboard;
	}, [dashboard]);

	// --- HELPERS ---
	const addLog = (
		msg: string,
		type: ActivityLog["type"] = "info",
		customTime?: string,
	) => {
		setActivityLogs((prev) =>
			[createLog(msg, type, customTime), ...prev].slice(0, 50),
		);
	};

	const resetLocalState = () => {
		setRaceState("READY");
		setLocalStartTime(null);
		setLaneData({});
		setActivityLogs([]);
	};

	// --- MUTATIONS ---
	const mutations = useTimerMutations({
		dashboard,
		queryClient,
		addLog,
		resetLocalState,
		laneData,
	});

	// --- ANIMATION ---
	const displayTime = useTimerAnimation(raceState, localStartTime);

	// --- SYNC STATE AWAL ---
	useHeatSync({
		dashboard,
		initializedHeatId,
		setInitializedHeatId,
		setRaceState,
		setLocalStartTime,
		setLaneData,
		setActivityLogs,
	});

	// --- MQTT ---
	useTimerMqtt({
		lanesRef,
		onStart: () => {
			setRaceState("RUNNING");
			setLocalStartTime(Date.now());
			setLaneData({});
			setActivityLogs([]);
			addLog("Pistol ditembakkan! Perlombaan dimulai.", "success");
		},
		onLap: (lane, elapsedMs, athleteName) => {
			setLaneData((prev) => {
				const currentLaps = prev[lane] || [];
				const lapOrder = currentLaps.length + 1;
				const isFinish =
					dashboardRef.current?.heat &&
					lapOrder >= dashboardRef.current.heat.maxLaps;

				if (isFinish) {
					addLog(
						`${athleteName} (Lintasan ${lane}) FINISH dengan waktu ${formatTime(elapsedMs)}!`,
						"success",
					);
				} else {
					addLog(
						`${athleteName} (Lintasan ${lane}) menyentuh dinding untuk Lap ${lapOrder}.`,
						"info",
					);
				}

				return { ...prev, [lane]: [...currentLaps, elapsedMs] };
			});
		},
		onStop: () => {
			setRaceState("STOPPED");
			addLog("Perlombaan dihentikan secara paksa (FORCE STOP).", "destructive");
		},
		onFinish: () => {
			setRaceState("FINISHED");
			addLog("🏁 Semua perenang telah menyelesaikan perlombaan!", "success");

			const heatId = dashboardRef.current?.heat?.id;
			if (heatId) {
				addLog("Mencetak struk hasil otomatis...", "info");
				mutations.printMutation.mutate(heatId);
				mutations.handleCloudSync();
			}
		},
	});

	// --- LOADING / EMPTY STATES ---
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
			<TimerHeader
				event={event}
				heat={heat}
				nextHeat={nextHeat}
				raceState={raceState}
				displayTime={displayTime}
				pendingHeats={pendingHeats}
				serverEventId={event?.serverEventId}
				mutations={{
					resetMutation: mutations.resetMutation,
					stopMutation: mutations.stopMutation,
					nextHeatMutation: mutations.nextHeatMutation,
					printMutation: mutations.printMutation,
					jumpToHeatMutation: mutations.jumpToHeatMutation,
					refreshLanesMutation: mutations.refreshLanesMutation,
					syncToSpeedzoneMutation: mutations.syncToSpeedzoneMutation,
				}}
				handlers={{
					handleForceStop: mutations.handleForceStop,
					handleResetHardware: mutations.handleResetHardware,
					handleCloudSync: mutations.handleCloudSync,
				}}
			/>

			<LaneGrid
				lanes={dashboard.lanes}
				laneData={laneData}
				maxLaps={heat.maxLaps}
				raceState={raceState}
				displayTime={displayTime}
			/>

			<ActivityLogTable logs={activityLogs} />
		</div>
	);
}
