// apps/web/src/server/excel.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import { events, heats, laneAssignments } from "@swimmer-timer/db/schema";
import { eq } from "drizzle-orm"; // WAJIB DITAMBAHKAN untuk logika Upsert

// 1. Definisikan Skema Data (Ditambah kolom ID dari Server Eksternal)
const LaneSchema = z.object({
	server_participant_id: z.number().optional().nullable(),
	laneNumber: z.number(),
	athleteName: z.string(),
	birthYear: z.string().nullable(),
	ageGroup: z.string().nullable(),
	clubName: z.string().nullable(),
	seedTime: z.string().nullable(),
});

const HeatSchema = z.object({
	server_heat_id: z.number().optional().nullable(),
	label: z.number(),
	maxLaps: z.number(),
	lanes: z.array(LaneSchema),
});

const EventSchema = z.object({
	server_event_id: z.number().optional().nullable(),
	eventName: z.string(),
	ageGroup: z.string(),
	distanceStyle: z.string(),
	gender: z.string(),
	heats: z.array(HeatSchema),
});

const ImportPayloadSchema = z.array(EventSchema);

export const insertBukuAcaraData = createServerFn({ method: "POST" })
	.validator(ImportPayloadSchema)
	.handler(async ({ data }) => {
		await db.transaction(async (tx) => {
			for (const ev of data) {
				let eventId: number;

				// ==========================================
				// 1. UPSERT ACARA (EVENT)
				// ==========================================
				if (ev.server_event_id) {
					const [existingEvent] = await tx
						.select()
						.from(events)
						.where(eq(events.serverEventId, ev.server_event_id));
					if (existingEvent) {
						eventId = existingEvent.id;
						await tx
							.update(events)
							.set({
								eventName: ev.eventName,
								ageGroup: ev.ageGroup,
								distanceStyle: ev.distanceStyle,
								gender: ev.gender,
							})
							.where(eq(events.id, eventId));
					} else {
						const [newEv] = await tx
							.insert(events)
							.values({
								serverEventId: ev.server_event_id,
								eventName: ev.eventName,
								ageGroup: ev.ageGroup,
								distanceStyle: ev.distanceStyle,
								gender: ev.gender,
							})
							.returning({ id: events.id });
						eventId = newEv.id;
					}
				} else {
					// Fallback untuk Excel manual
					const [newEv] = await tx
						.insert(events)
						.values({
							eventName: ev.eventName,
							ageGroup: ev.ageGroup,
							distanceStyle: ev.distanceStyle,
							gender: ev.gender,
						})
						.returning({ id: events.id });
					eventId = newEv.id;
				}

				// ==========================================
				// 2. UPSERT SERI (HEAT)
				// ==========================================
				for (const ht of ev.heats) {
					let heatId: number;

					if (ht.server_heat_id) {
						const [existingHeat] = await tx
							.select()
							.from(heats)
							.where(eq(heats.serverHeatId, ht.server_heat_id));
						if (existingHeat) {
							heatId = existingHeat.id;
							await tx
								.update(heats)
								.set({ label: ht.label, maxLaps: ht.maxLaps })
								.where(eq(heats.id, heatId));
						} else {
							const [newHt] = await tx
								.insert(heats)
								.values({
									eventId,
									serverHeatId: ht.server_heat_id,
									label: ht.label,
									status: "PENDING",
									isCurrent: false,
									maxLaps: ht.maxLaps,
								})
								.returning({ id: heats.id });
							heatId = newHt.id;
						}
					} else {
						const [newHt] = await tx
							.insert(heats)
							.values({
								eventId,
								label: ht.label,
								status: "PENDING",
								isCurrent: false,
								maxLaps: ht.maxLaps,
							})
							.returning({ id: heats.id });
						heatId = newHt.id;
					}

					// ==========================================
					// 3. UPSERT LINTASAN (LANE) - ANTI REWRITE WAKTU
					// ==========================================
					for (const lane of ht.lanes) {
						if (lane.server_participant_id) {
							const [existingLane] = await tx
								.select()
								.from(laneAssignments)
								.where(
									eq(
										laneAssignments.serverParticipantId,
										lane.server_participant_id,
									),
								);

							if (existingLane) {
								// HANYA UPDATE info identitas dan posisi lintasan.
								// Dilarang keras menimpa status perlombaan, finalTime, dan finalTimeMillis.
								await tx
									.update(laneAssignments)
									.set({
										heatId, // Antisipasi jika admin Speedzone memindah atlet ke seri (heat) yang berbeda
										laneNumber: lane.laneNumber,
										athleteName: lane.athleteName,
										clubName: lane.clubName || "-",
										seedTime: lane.seedTime || "-",
									})
									.where(eq(laneAssignments.id, existingLane.id));
							} else {
								await tx.insert(laneAssignments).values({
									heatId,
									serverParticipantId: lane.server_participant_id,
									laneNumber: lane.laneNumber,
									athleteName: lane.athleteName,
									birthYear: lane.birthYear || "-",
									ageGroup: lane.ageGroup || "-",
									clubName: lane.clubName || "-",
									seedTime: lane.seedTime || "-",
									status: "OK",
								});
							}
						} else {
							await tx.insert(laneAssignments).values({
								heatId,
								laneNumber: lane.laneNumber,
								athleteName: lane.athleteName,
								birthYear: lane.birthYear || "-",
								ageGroup: lane.ageGroup || "-",
								clubName: lane.clubName || "-",
								seedTime: lane.seedTime || "-",
								status: "OK",
							});
						}
					}
				}
			}
		});
		return {
			success: true,
			message:
				"Data struktur jadwal (Excel/Speedzone) berhasil diterapkan dengan aman!",
		};
	});
