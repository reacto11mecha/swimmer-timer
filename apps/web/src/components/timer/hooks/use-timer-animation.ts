// apps/web/src/components/timer/hooks/use-timer-animation.ts
import { useState, useEffect, useRef } from "react";
import type { RaceState } from "../types";

export function useTimerAnimation(
	raceState: RaceState,
	localStartTime: number | null,
) {
	const requestRef = useRef<number | null>(null);
	const [displayTime, setDisplayTime] = useState(0);

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

	return displayTime;
}
