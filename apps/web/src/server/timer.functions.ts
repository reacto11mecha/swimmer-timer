// server/timer.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import {
	events,
	heats,
	laneAssignments,
	lapTimes,
} from "@swimmer-timer/db/schema";

export const getLiveDashboard = createServerFn({ method: "GET" }).handler(
	async () => {
		// Kueri absolut tanpa tebak-tebakan status
		const heat = await db.query.heats.findFirst({
			where: eq(heats.isCurrent, true),
		});

		if (!heat) return null;

		const event = await db.query.events.findFirst({
			where: eq(events.id, heat.eventId),
		});

		const lanes = await db.query.laneAssignments.findMany({
			where: eq(laneAssignments.heatId, heat.id),
			orderBy: (lanes, { asc }) => [asc(lanes.laneNumber)],
		});

		const lanesWithData = await Promise.all(
			lanes.map(async (lane) => {
				const laps = await db.query.lapTimes.findMany({
					where: eq(lapTimes.laneAssignmentId, lane.id),
					orderBy: [asc(lapTimes.lapNumber)],
				});
				return { ...lane, laps };
			}),
		);

		return { event, heat, lanes: lanesWithData };
	},
);
