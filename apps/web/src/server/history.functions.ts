// src/server/history.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { events, heats, laneAssignments, lapTimes } from "@/db/schema";

export const wipeAllData = createServerFn({ method: "POST" }).handler(
	async () => {
		try {
			await db.transaction(async (tx) => {
				await tx.delete(lapTimes);
				await tx.delete(laneAssignments);
				await tx.delete(heats);
				await tx.delete(events);
			});

			return { success: true, message: "Database berhasil di-wipe bersih." };
		} catch (error: any) {
			throw new Error(`Gagal wipe database: ${error.message}`);
		}
	},
);

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
