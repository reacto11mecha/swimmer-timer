// apps/web/src/components/timer/hooks/use-timer-mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
	activateHeat,
	activateNextHeat,
	resetCurrentHeat,
} from "@/server/heat.functions";
import { printHeatResult } from "@/server/print.functions";
import { triggerStopHardware } from "@/server/mqtt.functions";
import {
	refreshHeatLanesFromSpeedzone,
	submitHeatResultsToSpeedzone,
} from "@/server/speedzone.functions";

import type { ActivityLog, LiveDashboard } from "../types";
import { formatTime } from "../utils";

interface Options {
	dashboard?: LiveDashboard | null;
	queryClient: ReturnType<typeof useQueryClient>;
	addLog: (msg: string, type?: ActivityLog["type"]) => void;
	resetLocalState: () => void;
	laneData: Record<number, number[]>;
}

export function useTimerMutations({
	dashboard,
	queryClient,
	addLog,
	resetLocalState,
	laneData,
}: Options) {
	const resetMutation = useMutation({
		mutationFn: (heatId: number) => resetCurrentHeat({ data: { heatId } }),
		onSuccess: (res: any) => {
			resetLocalState();
			addLog(res.message, "info");
			queryClient.invalidateQueries({ queryKey: ["liveTimer"] });
			toast.success("Heat beserta hardware telah direset.");
		},
		onError: (err: any) => {
			toast.error(`Gagal mereset: ${err.message}`);
		},
	});

	const stopMutation = useMutation({
		mutationFn: () => triggerStopHardware(),
		onSuccess: () => {
			addLog("Mengirim sinyal FORCE STOP ke perangkat keras...", "warning");
		},
	});

	const nextHeatMutation = useMutation({
		mutationFn: () => activateNextHeat(),
		onSuccess: (res: any) => {
			resetLocalState();
			addLog(res.message, "success");
		},
		onError: (err: any) => {
			alert(err.message);
		},
	});

	const printMutation = useMutation({
		mutationFn: (heatId: number) => printHeatResult({ data: { heatId } }),
		onSuccess: (res: any) => {
			addLog(res.message as string, "success");
			toast.success(res.message as string);
		},
		onError: (err: any) => {
			addLog(`Gagal Print: ${err.message}`, "destructive");
			toast.error(err.message);
		},
	});

	const jumpToHeatMutation = useMutation({
		mutationFn: (heatId: number) =>
			activateHeat({ data: { heatDbId: heatId } }),
		onSuccess: () => {
			resetLocalState();
			addLog(`Berhasil melompat ke seri.`, "success");
			queryClient.invalidateQueries({ queryKey: ["liveTimer"] });
			queryClient.invalidateQueries({ queryKey: ["pendingHeats"] });
			toast.success("Berhasil pindah seri!");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const refreshLanesMutation = useMutation({
		mutationFn: (eventId: number) =>
			refreshHeatLanesFromSpeedzone({ data: { eventId } }),
		onSuccess: () => {
			addLog("Data lintasan berhasil diperbarui dari peladen pusat.", "info");
			queryClient.invalidateQueries({ queryKey: ["liveTimer"] });
			toast.success("Data peserta diperbarui!");
		},
		onError: (err: any) =>
			toast.error(`Gagal memperbarui data: ${err.message}`),
	});

	const syncToSpeedzoneMutation = useMutation({
		mutationFn: (payload: any) =>
			submitHeatResultsToSpeedzone({ data: payload }),
		onSuccess: () => {
			addLog("Hasil perlombaan berhasil disinkronkan ke Cloud!", "success");
			toast.success("Catatan waktu berhasil disinkronkan!");
		},
		onError: (err: any) => {
			addLog(`Gagal sinkronisasi: ${err.message}`, "destructive");
			toast.error(`Gagal sinkronisasi: ${err.message}`);
		},
	});

	const handleForceStop = () => {
		if (
			window.confirm(
				"⚠️ PERINGATAN KELAS BERAT ⚠️\n\nApakah Anda yakin ingin MENGHENTIKAN PAKSA alat?\nWaktu detik akan berhenti dan perlombaan ini dianggap selesai/batal.",
			)
		) {
			stopMutation.mutate();
		}
	};

	const handleResetHardware = () => {
		if (!dashboard?.heat) return;
		if (
			window.confirm(
				"⚠️ PERINGATAN: RESET TOTAL ⚠️\n\nApakah Anda yakin ingin mereset KESELURUHAN heat ini?\nSeluruh data putaran dan waktu yang terekam akan dihapus dari server, perlombaan ini akan dikembalikan ke status PENDING, dan hardware akan di-reset ke angka 0.",
			)
		) {
			resetMutation.mutate(dashboard.heat.id);
		}
	};

	const handleCloudSync = () => {
		if (!dashboard?.event?.serverEventId || !dashboard?.heat) {
			toast.error("Data event server tidak ditemukan!");
			return;
		}

		const lanesPayload = dashboard.lanes
			.filter((lane: any) => lane.serverParticipantId)
			.map((lane: any) => {
				const hwLaps = laneData[lane.laneNumber] || [];
				const isFinished = hwLaps.length >= dashboard.heat!.maxLaps;

				let finalStatus = (lane.status || "OK").toUpperCase();
				if (finalStatus === "OK" && !isFinished) {
					finalStatus = "DNS";
				}

				const finalTimeStr = isFinished
					? formatTime(hwLaps[hwLaps.length - 1])
					: null;

				return {
					heat_lane_id: lane.serverParticipantId,
					result_time: finalTimeStr,
					result_status: finalStatus.toLowerCase() as "ok" | "dq" | "dns",
				};
			});

		toast.info("Mengemas data untuk sinkronisasi...");
		syncToSpeedzoneMutation.mutate({
			serverEventId: dashboard.event.serverEventId,
			heatIds: [dashboard.heat.id],
			lanes: lanesPayload,
		});
	};

	return {
		resetMutation,
		stopMutation,
		nextHeatMutation,
		printMutation,
		jumpToHeatMutation,
		refreshLanesMutation,
		syncToSpeedzoneMutation,
		handleForceStop,
		handleResetHardware,
		handleCloudSync,
	};
}
