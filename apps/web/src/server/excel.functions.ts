// src/server/excel.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { events, heats, laneAssignments } from "@swimmer-timer/db/schema";

// 1. Definisikan Skema Data yang Diharapkan dari Frontend
const LaneSchema = z.object({
	laneNumber: z.number(),
	athleteName: z.string(),
	clubName: z.string().nullable(),
	seedTime: z.string().nullable(),
});

const HeatSchema = z.object({
	label: z.number(),
	maxLaps: z.number(),
	lanes: z.array(LaneSchema),
});

const EventSchema = z.object({
	eventName: z.string(),
	ageGroup: z.string(),
	distanceStyle: z.string(),
	gender: z.string(),
	heats: z.array(HeatSchema),
});

// Skema utama yang diterima adalah array dari Acara (Event)
const ImportPayloadSchema = z.array(EventSchema);

export const insertBukuAcaraData = createServerFn({ method: "POST" })
	.validator(ImportPayloadSchema)
	.handler(async ({ data }) => {
		// Gunakan transaksi agar jika gagal di tengah jalan, seluruh data di-rollback
		await db.transaction(async (tx) => {
			for (const ev of data) {
				// Insert Acara
				const [insertedEvent] = await tx
					.insert(events)
					.values({
						eventName: ev.eventName,
						ageGroup: ev.ageGroup,
						distanceStyle: ev.distanceStyle,
						gender: ev.gender,
					})
					.returning({ id: events.id });

				for (const ht of ev.heats) {
					// Insert Heat/Seri
					const [insertedHeat] = await tx
						.insert(heats)
						.values({
							eventId: insertedEvent.id,
							label: ht.label,
							status: "PENDING",
							maxLaps: ht.maxLaps,
						})
						.returning({ id: heats.id });

					// Insert Lanes (jika ada)
					if (ht.lanes.length > 0) {
						await tx.insert(laneAssignments).values(
							ht.lanes.map((lane) => ({
								heatId: insertedHeat.id,
								laneNumber: lane.laneNumber,
								athleteName: lane.athleteName,
								clubName: lane.clubName || "-",
								seedTime: lane.seedTime || "-",
								status: "OK",
							})),
						);
					}
				}
			}
		});

		return {
			success: true,
			message: "Data Buku Acara berhasil disimpan ke database!",
		};
	});
