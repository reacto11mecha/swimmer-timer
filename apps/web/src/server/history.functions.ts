// src/server/history.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";

export const getHistoryData = createServerFn({ method: "GET" }).handler(
	async () => {
		// Tarik semua tabel secara paralel
		const [allEvents, allHeats, allLanes] = await Promise.all([
			db.query.events.findMany(),
			db.query.heats.findMany(),
			db.query.laneAssignments.findMany({
				orderBy: (lanes, { asc }) => [asc(lanes.laneNumber)],
			}),
		]);

		// Petakan relasi secara manual (Events -> Heats -> Lanes)
		const historyTree = allEvents.map((ev) => {
			const eventHeats = allHeats
				.filter((h) => h.eventId === ev.id)
				.map((ht) => ({
					...ht,
					lanes: allLanes.filter((l) => l.heatId === ht.id),
				}));

			return {
				...ev,
				heats: eventHeats,
			};
		});

		return historyTree;
	},
);
