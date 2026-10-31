// apps/web/src/components/timer/types.ts
import { getLiveDashboard } from "@/server/timer.functions";
import { getPendingHeats } from "@/server/heat.functions";

export type LiveDashboard = NonNullable<
	Awaited<ReturnType<typeof getLiveDashboard>>
>;
export type Event = NonNullable<LiveDashboard["event"]>;
export type Heat = LiveDashboard["heat"];
export type NextHeat = LiveDashboard["nextHeat"];

export type PendingHeats = Awaited<ReturnType<typeof getPendingHeats>>;

export interface ActivityLog {
	id: string;
	time: string;
	message: string;
	type: "info" | "success" | "warning" | "destructive";
}

export type RaceState = "READY" | "RUNNING" | "STOPPED" | "FINISHED";

export interface LaneLap {
	lapNumber: number;
	rawMillis: number;
}

export interface Lane {
	id: string | number;
	laneNumber: number;
	groupLabel?: string | null;
	athleteName?: string | null;
	clubName?: string | null;
	status?: string | null;
	serverParticipantId?: number | null;
	laps?: LaneLap[];
}
