import { createServerFn } from "@tanstack/react-start";
import { eq, inArray } from "drizzle-orm";
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
				event: {
					eventName: events.eventName,
					distanceStyle: events.distanceStyle,
					ageGroup: events.ageGroup,
					gender: events.gender,
				},
			})
			.from(heats)
			.innerJoin(events, eq(heats.eventId, events.id))
			.where(inArray(heats.status, ["CURRENT", "RUNNING"]))
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
			.where(eq(heats.status, "PENDING"));

		return result;
	},
);

export const activateHeat = createServerFn({ method: "POST" })
	.validator(z.object({ heatDbId: z.number().min(1, "ID Heat tidak valid") }))
	.handler(async ({ data }) => {
		await db.transaction(async (tx) => {
			await tx
				.update(heats)
				.set({ status: "PENDING" })
				.where(inArray(heats.status, ["CURRENT", "RUNNING"]));

			await tx
				.update(heats)
				.set({ status: "CURRENT" })
				.where(eq(heats.id, data.heatDbId));
		});

		// Reset Hardware via MQTT saat heat baru diaktifkan
		await publishResetToHardware();
		return { success: true, message: `Heat ${data.heatDbId} diaktifkan.` };
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
