// src/server/excel.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { events, heats, laneAssignments } from "@swimmer-timer/db/schema";

// 1. Definisikan Skema Data yang Diharapkan dari Frontend
const LaneSchema = z.object({
	laneNumber: z.number(),
	athleteName: z.string(),
	birthYear: z.string().nullable(),
	ageGroup: z.string().nullable(),
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
		await db.transaction(async (tx) => {
			for (const ev of data) {
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
					const [insertedHeat] = await tx
						.insert(heats)
						.values({
							eventId: insertedEvent.id,
							label: ht.label,
							status: "PENDING",
							isCurrent: false,
							maxLaps: ht.maxLaps,
						})
						.returning({ id: heats.id });

					if (ht.lanes.length > 0) {
						await tx.insert(laneAssignments).values(
							ht.lanes.map((lane) => ({
								heatId: insertedHeat.id,
								laneNumber: lane.laneNumber,
								athleteName: lane.athleteName,
								birthYear: lane.birthYear || "-",
								ageGroup: lane.ageGroup || "-",
								clubName: lane.clubName || "-",
								seedTime: lane.seedTime || "-",
								status: "OK" as const,
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
