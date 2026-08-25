// apps/web/src/server/timer.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import {
	events,
	heats,
	laneAssignments,
	lapTimes,
} from "@swimmer-timer/db/schema";

export const getLiveDashboard = createServerFn({ method: "GET" }).handler(
	async () => {
		// 1. Kueri heat yang sedang berjalan
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

		// 2. Kueri "Heat Selanjutnya" untuk ditampilkan di tombol
		const nextHeatResult = await db
			.select({
				label: heats.label,
				eventName: events.eventName,
			})
			.from(heats)
			.innerJoin(events, eq(heats.eventId, events.id))
			.where(and(eq(heats.status, "PENDING"), eq(heats.isCurrent, false)))
			.orderBy(asc(heats.eventId), asc(heats.label))
			.limit(1);

		const nextHeat = nextHeatResult[0] || null;

		return { event, heat, lanes: lanesWithData, nextHeat };
	},
);
