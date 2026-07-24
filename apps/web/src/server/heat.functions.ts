// server/heat.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { events, heats } from "@swimmer-timer/db/schema";
import { publishResetToHardware } from "./mqtt.functions";

export const getRunningHeat = createServerFn({ method: "GET" }).handler(
	async () => {
		const result = await db
			.select({
				id: heats.id,
				label: heats.label,
				maxLaps: heats.maxLaps,
				status: heats.status,
				isCurrent: heats.isCurrent,
				event: {
					eventName: events.eventName,
					distanceStyle: events.distanceStyle,
					ageGroup: events.ageGroup,
					gender: events.gender,
				},
			})
			.from(heats)
			.innerJoin(events, eq(heats.eventId, events.id))
			// Cukup cari mana yang saat ini tampil di layar
			.where(eq(heats.isCurrent, true))
			.limit(1);

		return result[0] || null;
	},
);

export const getPendingHeats = createServerFn({ method: "GET" }).handler(
	async () => {
		const result = await db
			.select({
				id: heats.id,
				label: heats.label,
				maxLaps: heats.maxLaps,
				status: heats.status,
				event: {
					eventName: events.eventName,
					distanceStyle: events.distanceStyle,
					ageGroup: events.ageGroup,
					gender: events.gender,
				},
			})
			.from(heats)
			.innerJoin(events, eq(heats.eventId, events.id))
			// Pastikan bukan yang sedang current
			.where(and(eq(heats.status, "PENDING"), eq(heats.isCurrent, false)));

		return result;
	},
);

export const activateHeat = createServerFn({ method: "POST" })
	.validator(z.object({ heatDbId: z.number().min(1, "ID Heat tidak valid") }))
	.handler(async ({ data }) => {
		// TRANSAKSI DATABASE
		await db.transaction(async (tx) => {
			// 1. Matikan indikator current di SELURUH heat
			await tx
				.update(heats)
				.set({ isCurrent: false })
				.where(eq(heats.isCurrent, true));

			// 2. Nyalakan indikator current khusus di heat terpilih
			await tx
				.update(heats)
				.set({ isCurrent: true })
				.where(eq(heats.id, data.heatDbId));
		});

		await publishResetToHardware();
		return {
			success: true,
			message: `Heat ${data.heatDbId} berhasil dipersiapkan ke kolam.`,
		};
	});

export const updateHeatMaxLaps = createServerFn({ method: "POST" })
	.validator(
		z.object({
			heatId: z.number(),
			maxLaps: z.number().min(1, "Minimal harus 1 lap"),
		}),
	)
	.handler(async ({ data }) => {
		await db
			.update(heats)
			.set({ maxLaps: data.maxLaps })
			.where(eq(heats.id, data.heatId));
		return { success: true, message: "Jumlah lap berhasil diperbarui." };
	});
