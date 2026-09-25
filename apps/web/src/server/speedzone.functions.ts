// apps/web/src/server/speedzone.functions.ts
import { db } from "@/db";
import { heats } from "@swimmer-timer/db/schema";
import { inArray } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { fetchSpeedzone } from "./speedzone.api";

// 1. Ambil Daftar Kompetisi
export const getCompetitions = createServerFn({ method: "GET" }).handler(
	async () => {
		// Endpoint: /api/external/competitions
		const result = await fetchSpeedzone("/api/external/competitions");
		return result;
	},
);

// 2. Ambil Daftar Event Berdasarkan Kompetisi
export const getEventsByCompetition = createServerFn({ method: "GET" })
	.validator((competitionId: number) => competitionId)
	.handler(async (ctx) => {
		// Ubah per_page=50 menjadi per_page=200
		const result = await fetchSpeedzone(
			`/api/external/events?filter[competition_id]=${ctx.data}&sort=number&per_page=200`,
		);
		return result;
	});

// 3. Ambil Starting List dari Event Spesifik
export const getStartingList = createServerFn({ method: "GET" })
	.validator((eventId: number) => eventId)
	.handler(async (ctx) => {
		// Endpoint: /api/external/events/{event}/starting-list
		const result = await fetchSpeedzone(
			`/api/external/events/${ctx.data}/starting-list`,
		);
		return result;
	});

// 4. Kirim Hasil Lomba (Setor Waktu) ke Speedzone & Update Lokal
export const submitHeatResultsToSpeedzone = createServerFn({ method: "POST" })
	.validator(
		(payload: {
			serverEventId: number;
			heatIds: number[]; // <-- Tambahan: Array ID heat lokal yang akan di-update
			lanes: Array<{
				heat_lane_id: number;
				result_time?: string | null;
				result_status?: "ok" | "dq" | "dns";
			}>;
		}) => payload,
	)
	.handler(async (ctx) => {
		// 1. Tembak API Eksternal
		// Endpoint: PUT /api/external/events/{event}/results
		const result = await fetchSpeedzone(
			`/api/external/events/${ctx.data.serverEventId}/results`,
			{
				method: "PUT",
				body: JSON.stringify({ lanes: ctx.data.lanes }),
			},
		);

		// 2. Jika API di atas sukses (tidak melempar error), update database lokal
		if (ctx.data.heatIds.length > 0) {
			await db
				.update(heats)
				.set({ isSynced: true })
				.where(inArray(heats.id, ctx.data.heatIds));
		}

		return result;
	});
