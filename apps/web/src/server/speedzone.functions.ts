// apps/web/src/server/speedzone.functions.ts
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

// 4. Kirim Hasil Lomba (Setor Waktu) ke Speedzone
export const submitHeatResultsToSpeedzone = createServerFn({ method: "POST" })
	.validator(
		(payload: {
			serverEventId: number;
			lanes: Array<{
				heat_lane_id: number;
				result_time?: string | null;
				result_status?: "ok" | "dq" | "dns";
			}>;
		}) => payload,
	)
	.handler(async (ctx) => {
		// Endpoint: PUT /api/external/events/{event}/results
		const result = await fetchSpeedzone(
			`/api/external/events/${ctx.data.serverEventId}/results`,
			{
				method: "PUT",
				body: JSON.stringify({ lanes: ctx.data.lanes }),
			},
		);
		return result;
	});
