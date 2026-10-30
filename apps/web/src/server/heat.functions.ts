// apps/web/src/server/heat.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { eq, and, or, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
	events,
	heats,
	laneAssignments,
	lapTimes,
} from "@swimmer-timer/db/schema";
import { publishStopAndResetHardware } from "./mqtt.functions";

export const activateNextHeat = createServerFn({ method: "POST" }).handler(
	async () =>
		await db.transaction(async (tx) => {
			// 1. Cari heat yang sedang aktif di layar
			const currentHeat = await tx.query.heats.findFirst({
				where: eq(heats.isCurrent, true),
			});

			if (currentHeat) {
				// VALIDASI: Wajib Force Stop Jika Sedang Berjalan
				if (currentHeat.status === "RUNNING") {
					throw new Error(
						"Heat saat ini masih berjalan (RUNNING). Silakan tekan tombol 'Force Stop' terlebih dahulu sebelum berpindah seri.",
					);
				}

				// Cabut status "isCurrent"-nya saja
				await tx
					.update(heats)
					.set({ isCurrent: false })
					.where(eq(heats.id, currentHeat.id));
			}

			// 2. Cari heat PENDING selanjutnya yang posisinya SETELAH currentHeat
			let nextHeatCondition = and(
				eq(heats.status, "PENDING"),
				eq(heats.isCurrent, false),
			);

			if (currentHeat) {
				// Logika: Cari event yang ID-nya lebih besar, ATAU event-nya sama tapi urutan seri (label)-nya lebih besar
				nextHeatCondition = and(
					eq(heats.status, "PENDING"),
					eq(heats.isCurrent, false),
					or(
						gt(heats.eventId, currentHeat.eventId),
						and(
							eq(heats.eventId, currentHeat.eventId),
							gt(heats.label, currentHeat.label),
						),
					),
				);
			}

			const nextHeat = await tx.query.heats.findFirst({
				where: nextHeatCondition,
				orderBy: (heats, { asc }) => [asc(heats.eventId), asc(heats.label)],
			});

			if (!nextHeat) {
				throw new Error(
					"Tidak ada seri (heat) selanjutnya yang berstatus PENDING di antrean.",
				);
			}

			// 3. Aktifkan heat yang baru
			await tx
				.update(heats)
				.set({ isCurrent: true })
				.where(eq(heats.id, nextHeat.id));

			// 4. Reset Hardware
			try {
				await publishStopAndResetHardware();
			} catch (err) {
				console.error("[activateNextHeat] Gagal reset hardware:", err);
			}

			return {
				success: true,
				message: `Berhasil pindah ke seri selanjutnya!`,
			};
		}),
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
	.handler(
		async ({ data }) =>
			await db.transaction(async (tx) => {
				// 1. Amankan heat yang sedang aktif (isCurrent: true)
				const currentHeat = await tx.query.heats.findFirst({
					where: eq(heats.isCurrent, true),
				});

				if (currentHeat) {
					// VALIDASI: Wajib Force Stop Jika Sedang Berjalan
					if (currentHeat.status === "RUNNING") {
						throw new Error(
							"Heat saat ini masih berjalan (RUNNING). Silakan hentikan paksa (Force Stop) terlebih dahulu sebelum melompat ke seri lain.",
						);
					}

					// Turunkan status isCurrent dari heat sebelumnya tanpa merusak status aslinya
					await tx
						.update(heats)
						.set({ isCurrent: false })
						.where(eq(heats.id, currentHeat.id));
				}

				// 2. Set isCurrent pada heat target
				await tx
					.update(heats)
					.set({ isCurrent: true })
					.where(eq(heats.id, data.heatDbId));

				// 3. Reset Hardware agar stopwatch bersih untuk heat baru
				try {
					await publishStopAndResetHardware();
				} catch (err) {
					console.error("[activateHeat] Gagal reset hardware:", err);
					throw new Error("Gagal mengirim sinyal ke perangkat keras.");
				}

				return {
					success: true,
					message: `Berhasil melompat ke Heat ID ${data.heatDbId}.`,
				};
			}),
	);

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

export const resetCurrentHeat = createServerFn({ method: "POST" })
	.validator(
		z.object({
			heatId: z.number(),
		}),
	)
	.handler(
		async ({ data: { heatId } }) =>
			await db.transaction(async (tx) => {
				try {
					// 1. Ambil semua laneId yang ada di heat ini
					const existingLanes = await tx
						.select({ id: laneAssignments.id })
						.from(laneAssignments)
						.where(eq(laneAssignments.heatId, heatId));

					const laneIds = existingLanes.map((l) => l.id);

					// 2. Hapus seluruh riwayat putaran (laps) pada lane yang bersangkutan
					if (laneIds.length > 0) {
						for (const lId of laneIds) {
							await tx.delete(lapTimes).where(eq(lapTimes.id, lId));
						}
					}

					// 3. Reset nilai waktu final di tabel lanes menjadi kosong
					if (laneIds.length > 0) {
						for (const lId of laneIds) {
							await tx
								.update(laneAssignments)
								.set({
									finalTime: null,
									finalTimeMillis: null,
									status: "OK", // Kembalikan ke OK
								})
								.where(eq(laneAssignments.id, lId));
						}
					}

					// 4. Ubah kembali status heat ke PENDING & hapus started_at
					await tx
						.update(heats)
						.set({
							status: "PENDING",
							startedAt: null,
						})
						.where(eq(heats.id, heatId));

					// 5. Kirim Sinyal Reset ke Hardware
					await publishStopAndResetHardware();

					return {
						success: true,
						message: "Heat dan Hardware berhasil di-reset sepenuhnya.",
					};
				} catch (error: any) {
					throw new Error(`Gagal mereset heat: ${error.message}`);
				}
			}),
	);
