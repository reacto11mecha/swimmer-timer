// apps/web/src/server/heat.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { events, heats } from "@swimmer-timer/db/schema";
import { publishStopAndResetHardware } from "./mqtt.functions";

export const activateNextHeat = createServerFn({ method: "POST" }).handler(
	async () => {
		// 1. Cari heat yang sedang aktif di layar
		const currentHeat = await db.query.heats.findFirst({
			where: eq(heats.isCurrent, true),
		});

		if (currentHeat) {
			// Jika statusnya RUNNING atau PENDING (belum mulai tapi di-skip), jadikan STOPPED
			let newStatus = currentHeat.status;
			if (
				currentHeat.status === "RUNNING" ||
				currentHeat.status === "PENDING"
			) {
				newStatus = "STOPPED";
			}

			await db
				.update(heats)
				.set({ isCurrent: false, status: newStatus })
				.where(eq(heats.id, currentHeat.id));
		}

		// 2. Cari heat PENDING selanjutnya berdasarkan urutan event dan label
		const nextHeat = await db.query.heats.findFirst({
			where: and(eq(heats.status, "PENDING"), eq(heats.isCurrent, false)),
			orderBy: (heats, { asc }) => [asc(heats.eventId), asc(heats.label)],
		});

		if (!nextHeat) {
			throw new Error(
				"Tidak ada seri (heat) selanjutnya yang berstatus PENDING di antrean.",
			);
		}

		// 3. Aktifkan heat yang baru
		await db
			.update(heats)
			.set({ isCurrent: true })
			.where(eq(heats.id, nextHeat.id));

		// 4. Hentikan dan Reset Hardware agar stopwatch kembali ke 00:00.000
		try {
			await publishStopAndResetHardware();
		} catch (err) {
			console.error("[activateNextHeat] Gagal reset hardware:", err);
			// Kita tidak melempar error di sini agar UI tetap bisa pindah heat
			// meskipun hardware sedang offline sebentar.
		}

		return {
			success: true,
			message: `Berhasil beralih ke Heat ${nextHeat.label}. Perangkat keras di-reset.`,
		};
	},
);

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
			.where(and(eq(heats.status, "PENDING"), eq(heats.isCurrent, false)));

		return result;
	},
);

export const activateHeat = createServerFn({ method: "POST" })
	.validator(z.object({ heatDbId: z.number().min(1, "ID Heat tidak valid") }))
	.handler(async ({ data }) => {
		// 1. Amankan heat yang sedang berjalan (jika ada)
		const runningHeat = await db.query.heats.findFirst({
			where: and(eq(heats.isCurrent, true), eq(heats.status, "RUNNING")),
		});

		if (runningHeat) {
			// Tandai heat lama sebagai STOPPED
			await db
				.update(heats)
				.set({ status: "STOPPED" })
				.where(eq(heats.id, runningHeat.id));
			console.log(
				`[activateHeat] Heat ${runningHeat.label} yang sedang berjalan dihentikan paksa (STOPPED).`,
			);
		}

		// 2. Hentikan hardware (STOP) lalu RESET agar siap untuk heat baru
		try {
			await publishStopAndResetHardware();
		} catch (err) {
			console.error("[activateHeat] Gagal menghentikan/reset hardware:", err);
			throw new Error("Gagal mengirim sinyal ke perangkat keras.");
		}

		// 3. Transaksi ganti isCurrent ke heat baru
		await db.transaction(async (tx) => {
			await tx
				.update(heats)
				.set({ isCurrent: false })
				.where(eq(heats.isCurrent, true));

			await tx
				.update(heats)
				.set({ isCurrent: true })
				.where(eq(heats.id, data.heatDbId));
		});

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
