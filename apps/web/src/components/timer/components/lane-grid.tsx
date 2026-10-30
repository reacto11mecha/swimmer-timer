// apps/web/src/components/timer/components/lane-grid.tsx
import type { Lane, RaceState } from "../types";
import { LaneCard } from "./lane-card";

interface Props {
	lanes: Lane[];
	laneData: Record<number, number[]>;
	maxLaps: number;
	raceState: RaceState;
	displayTime: number;
}

export function LaneGrid({
	lanes,
	laneData,
	maxLaps,
	raceState,
	displayTime,
}: Props) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			{lanes.map((lane) => (
				<LaneCard
					key={lane.id}
					lane={lane}
					hwLaps={laneData[lane.laneNumber] || []}
					maxLaps={maxLaps}
					raceState={raceState}
					displayTime={displayTime}
				/>
			))}
		</div>
	);
}
