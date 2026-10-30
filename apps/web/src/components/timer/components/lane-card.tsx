// apps/web/src/components/timer/components/lane-card.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timer } from "lucide-react";

import type { Lane, RaceState } from "../types";
import { formatTime } from "../utils";

interface Props {
	lane: Lane;
	hwLaps: number[];
	maxLaps: number;
	raceState: RaceState;
	displayTime: number;
}

export function LaneCard({
	lane,
	hwLaps,
	maxLaps,
	raceState,
	displayTime,
}: Props) {
	const lastLapMs = hwLaps.length > 0 ? hwLaps[hwLaps.length - 1] : 0;
	const isFinished = hwLaps.length >= maxLaps;

	return (
		<Card
			className={`overflow-hidden shadow-sm border-2 ${
				isFinished
					? "border-yellow-400 dark:border-yellow-600"
					: "border-transparent"
			}`}
		>
			<div
				className={`p-2 text-center text-white font-bold text-sm flex justify-between px-4 ${
					isFinished
						? "bg-yellow-500"
						: raceState === "RUNNING"
							? "bg-blue-600"
							: "bg-slate-700"
				}`}
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
					className={`p-3 rounded-lg flex items-center justify-between border ${
						isFinished
							? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900"
							: "bg-slate-900 text-white dark:bg-black border-slate-800"
					}`}
				>
					<Timer
						className={`h-5 w-5 ${
							raceState === "RUNNING" && !isFinished
								? "text-blue-400 animate-pulse"
								: isFinished
									? "text-yellow-600 dark:text-yellow-400"
									: "opacity-50"
						}`}
					/>
					<span
						className={`font-mono text-2xl font-bold tracking-wider ${
							isFinished ? "text-yellow-700 dark:text-yellow-400" : ""
						}`}
					>
						{isFinished || raceState === "STOPPED" || raceState === "FINISHED"
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
									<span className="text-muted-foreground">Lap {idx + 1}</span>
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
}
