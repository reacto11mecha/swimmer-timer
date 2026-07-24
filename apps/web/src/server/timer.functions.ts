import { createServerFn } from "@tanstack/react-start";
import { eq, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
	events,
	heats,
	laneAssignments,
	lapTimes,
} from "@swimmer-timer/db/schema";

export const getLiveDashboard = createServerFn({ method: "GET" }).handler(
	async () => {
		const heat = await db.query.heats.findFirst({
			where: inArray(heats.status, ["CURRENT", "RUNNING", "FINISHED"]),
		});
		if (!heat) return null;

		const event = await db.query.events.findFirst({
			where: eq(events.id, heat.eventId),
		});

		const lanes = await db.query.laneAssignments.findMany({
			where: eq(laneAssignments.heatId, heat.id),
			orderBy: (lanes, { asc }) => [asc(lanes.laneNumber)],
		});

		// Ambil SEMUA riwayat lap untuk masing-masing lintasan
		const lanesWithData = await Promise.all(
			lanes.map(async (lane) => {
				const laps = await db.query.lapTimes.findMany({
					where: eq(lapTimes.laneAssignmentId, lane.id),
					orderBy: [asc(lapTimes.lapNumber)], // Urutkan dari Lap 1 ke atas
				});
				return { ...lane, laps };
			}),
		);

		return { event, heat, lanes: lanesWithData };
	},
);
