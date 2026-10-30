// apps/web/src/components/timer/hooks/use-heat-sync.ts
import { useEffect } from "react";
import type { ActivityLog, Lane, LiveDashboard, RaceState } from "../types";
import { formatTime } from "../utils";

interface Options {
	dashboard?: LiveDashboard | null;
	initializedHeatId: number | null;
	setInitializedHeatId: (id: number | null) => void;
	setRaceState: (s: RaceState) => void;
	setLocalStartTime: (t: number | null) => void;
	setLaneData: (d: Record<number, number[]>) => void;
	setActivityLogs: (l: ActivityLog[]) => void;
}

export function useHeatSync({
	dashboard,
	initializedHeatId,
	setInitializedHeatId,
	setRaceState,
	setLocalStartTime,
	setLaneData,
	setActivityLogs,
}: Options) {
	useEffect(() => {
		if (!dashboard?.heat || dashboard.heat.id === initializedHeatId) return;

		const heat = dashboard.heat;
		const startMs = heat.startedAt ? new Date(heat.startedAt).getTime() : null;

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

		dashboard.lanes.forEach((lane: Lane) => {
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
			// displayTime otomatis di-reset oleh useTimerAnimation
		}

		setActivityLogs(historicalLogs.reverse());
		setLaneData(restoredLaneData);
		setInitializedHeatId(heat.id);
	}, [dashboard?.heat?.id, initializedHeatId]);
}
