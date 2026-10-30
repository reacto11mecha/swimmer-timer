// apps/web/src/components/timer/utils.ts
import type { ActivityLog } from "./types";

export const formatTime = (ms: number) => {
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

export const createLog = (
	message: string,
	type: ActivityLog["type"] = "info",
	customTime?: string,
): ActivityLog => ({
	id: Math.random().toString(36).substr(2, 9),
	time: customTime || new Date().toLocaleTimeString("id-ID", { hour12: false }),
	message,
	type,
});
