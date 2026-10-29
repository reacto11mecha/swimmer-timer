// apps/web/src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getHistoryData } from "@/server/history.functions";
import { printHeatResult } from "@/server/print.functions";
import { submitHeatResultsToSpeedzone } from "@/server/speedzone.functions";
import { Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { wipeAllData } from "@/server/history.functions";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	CloudOff,
	CloudUpload,
	Download,
	FolderClock,
	History,
	Clock,
	Printer,
	RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/")({
	component: DashboardHomePage,
});

function DashboardHomePage() {
	const queryClient = useQueryClient();
	const [filter, setFilter] = useState<"ALL" | "SYNCED" | "UNSYNCED">("ALL");

	const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
	const [wipeTextConfirm, setWipeTextConfirm] = useState("");
	const [wipeCheckbox, setWipeCheckbox] = useState(false);

	const wipeMutation = useMutation({
		mutationFn: () => wipeAllData(),
		onSuccess: (res) => {
			toast.success(res.message || "Seluruh data berhasil dihapus!");
			setIsWipeModalOpen(false);
			setWipeTextConfirm("");
			setWipeCheckbox(false);
			// Refresh semua data di halaman
			queryClient.invalidateQueries({ queryKey: ["historyData"] });
		},
		onError: (err: any) => {
			toast.error(`Gagal menghapus data: ${err.message}`);
		},
	});

	// Fetch semua histori data
	const { data: events = [], isLoading } = useQuery({
		queryKey: ["historyData"],
		queryFn: () => getHistoryData(),
	});

	const printMutation = useMutation({
		mutationFn: (heatId: number) => printHeatResult({ data: { heatId } }),
		onSuccess: (res) => toast.success(res.message as string),
		onError: (err: any) => toast.error(`Gagal mencetak: ${err.message}`),
	});

	// Mutasi untuk Sinkronisasi ke Speedzone
	const syncToSpeedzoneMutation = useMutation({
		mutationFn: (payload: {
			serverEventId: number;
			heatIds: number[];
			lanes: Array<{
				heat_lane_id: number;
				result_time?: string | null;
				result_status?: "ok" | "dq" | "dns";
			}>;
		}) => submitHeatResultsToSpeedzone({ data: payload }),
		onSuccess: () => {
			toast.success("Catatan waktu berhasil disinkronkan ke pusat!");
			// invalidateQueries ini yang akan me-refresh tampilan agar label berubah jadi "Sudah Sinkron"
			queryClient.invalidateQueries({ queryKey: ["historyData"] });
		},
		onError: (err: any) => {
			toast.error(`Gagal sinkronisasi: ${err.message}`);
		},
	});

	// Logika Filter Data
	const filteredEvents = events
		.map((ev) => {
			// Saring heat berdasarkan status sinkronisasi
			const filteredHeats = ev.heats.filter((ht) => {
				if (filter === "ALL") return true;
				if (filter === "SYNCED") return ht.isSynced === true;
				if (filter === "UNSYNCED") return ht.isSynced === false;
				return true;
			});

			return { ...ev, heats: filteredHeats };
		})
		// Hanya tampilkan event yang memiliki heat setelah difilter
		.filter((ev) => ev.heats.length > 0);

	// Fungsi Ekspor Excel
	const handleExportExcel = async () => {
		toast.info("Menyiapkan dokumen Excel...");
		try {
			const ExcelJS = (await import("exceljs")).default;
			const workbook = new ExcelJS.Workbook();
			const sheet = workbook.addWorksheet("Hasil & Riwayat");

			// Format Lebar Kolom (7 Kolom)
			sheet.columns = [
				{ width: 8 }, // A: Ln.
				{ width: 35 }, // B: Nama
				{ width: 12 }, // C: Thn Lahir
				{ width: 12 }, // D: KU
				{ width: 30 }, // E: Asal Sekolah/Klub
				{ width: 15 }, // F: QET
				{ width: 15 }, // G: Hasil (Waktu / DSQ / DNS)
			];

			events.forEach((ev) => {
				const eventRow = sheet.addRow([
					ev.eventName,
					ev.distanceStyle,
					"",
					ev.gender,
					ev.ageGroup,
				]);
				eventRow.font = { bold: true, size: 12 };

				ev.heats.forEach((ht) => {
					const heatRow = sheet.addRow([`Seri ${ht.label}`]);
					heatRow.font = { italic: true, bold: true };

					const headerRow = sheet.addRow([
						"Ln.",
						"Nama",
						"Thn Lahir",
						"KU",
						"Asal Sekolah/Klub",
						"QET",
						"Hasil",
					]);
					headerRow.font = { bold: true };
					headerRow.fill = {
						type: "pattern",
						pattern: "solid",
						fgColor: { argb: "FFF2F2F2" },
					};

					// Urutkan berdasarkan lintasan (opsional, tapi rapi untuk laporan)
					const sortedLanes = [...ht.lanes].sort(
						(a, b) => a.laneNumber - b.laneNumber,
					);

					sortedLanes.forEach((lane) => {
						// LOGIKA INTERSEPSI DNS
						let hasilAkhir = lane.finalTime || "-";

						if (lane.status && lane.status !== "OK") {
							hasilAkhir = lane.status; // Cetak DSQ/DNF
						} else if (!lane.finalTime) {
							if (ht.status === "FINISHED" || ht.status === "STOPPED") {
								hasilAkhir = "DNS"; // Lomba selesai tapi tidak ada waktu = tidak hadir
							} else {
								hasilAkhir = "-"; // Lomba belum/sedang berjalan
							}
						}

						sheet.addRow([
							lane.laneNumber,
							lane.athleteName,
							lane.birthYear,
							lane.ageGroup,
							lane.clubName,
							lane.seedTime,
							hasilAkhir,
						]);
					});

					sheet.addRow([]); // Baris kosong pemisah antar seri
				});
			});

			const buffer = await workbook.xlsx.writeBuffer();
			const blob = new Blob([buffer], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `Riwayat_Perlombaan_${new Date().toISOString().split("T")[0]}.xlsx`;
			a.click();
			window.URL.revokeObjectURL(url);

			toast.success("Excel berhasil diunduh!");
		} catch (error) {
			toast.error("Gagal membuat file Excel.");
			console.error(error);
		}
	};

	// Eksekusi Sinkronisasi (Kirim Waktu Final)
	const handleSync = async () => {
		toast.info("Mengemas data hasil akhir untuk sinkronisasi...");

		// Tambahkan kondisi STOPPED pada filter utama
		const eventsToSync = events.filter(
			(ev) =>
				ev.serverEventId !== null &&
				ev.heats.some(
					(ht) =>
						(ht.status === "FINISHED" || ht.status === "STOPPED") &&
						!ht.isSynced,
				),
		);

		if (eventsToSync.length === 0) {
			toast.warning("Tidak ada data baru yang perlu disinkronkan.");
			return;
		}

		for (const ev of eventsToSync) {
			const lanesPayload: any[] = [];
			const heatIdsToSync: number[] = [];

			ev.heats.forEach((ht) => {
				// Tambahkan kondisi STOPPED pada saat loop data heat
				if (
					(ht.status === "FINISHED" || ht.status === "STOPPED") &&
					!ht.isSynced
				) {
					heatIdsToSync.push(ht.id);

					ht.lanes.forEach((lane) => {
						if (lane.serverParticipantId) {
							// Logika intersepsi (override) DNS yang sudah kita bahas
							let currentStatus = (lane.status || "OK").toUpperCase();
							if (currentStatus === "OK" && !lane.finalTime) {
								currentStatus = "DNS";
							}

							lanesPayload.push({
								heat_lane_id: lane.serverParticipantId,
								result_time: lane.finalTime,
								result_status: currentStatus.toLowerCase() as
									| "ok"
									| "dq"
									| "dns",
							});
						}
					});
				}
			});

			if (lanesPayload.length > 0 && ev.serverEventId) {
				syncToSpeedzoneMutation.mutate({
					serverEventId: ev.serverEventId,
					heatIds: heatIdsToSync,
					lanes: lanesPayload,
				});
			}
		}
	};

	return (
		<div className="container mx-auto p-6 max-w-7xl space-y-8">
			{/* HEADER HALAMAN */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Pusat Riwayat & Data
					</h1>
					<p className="text-muted-foreground mt-1">
						Lihat seluruh hasil catatan waktu perlombaan, unduh rekapitulasi,
						dan sinkronkan data ke peladen pusat.
					</p>
				</div>
				<div className="flex gap-3">
					<Button
						variant="outline"
						onClick={handleExportExcel}
						disabled={isLoading || events.length === 0}
					>
						<Download className="w-4 h-4 mr-2" /> Rekap Excel
					</Button>
					<Button
						onClick={handleSync}
						disabled={syncToSpeedzoneMutation.isPending || isLoading}
						className="bg-blue-600 hover:bg-blue-700"
					>
						{syncToSpeedzoneMutation.isPending ? (
							<RefreshCw className="w-4 h-4 mr-2 animate-spin" />
						) : (
							<CloudUpload className="w-4 h-4 mr-2" />
						)}
						{syncToSpeedzoneMutation.isPending
							? "Menyinkronkan..."
							: "Sinkronisasi Cloud"}
					</Button>
				</div>
			</div>

			{/* NAVIGASI FILTER */}
			<div className="flex gap-2 p-1 bg-muted/50 rounded-lg w-fit">
				<Button
					variant={filter === "ALL" ? "default" : "ghost"}
					size="sm"
					onClick={() => setFilter("ALL")}
				>
					<History className="w-4 h-4 mr-2" /> Semua Data
				</Button>
				<Button
					variant={filter === "UNSYNCED" ? "default" : "ghost"}
					size="sm"
					onClick={() => setFilter("UNSYNCED")}
				>
					<CloudOff className="w-4 h-4 mr-2" /> Belum Sinkron
				</Button>
				<Button
					variant={filter === "SYNCED" ? "default" : "ghost"}
					size="sm"
					onClick={() => setFilter("SYNCED")}
				>
					<CloudUpload className="w-4 h-4 mr-2" /> Sudah Sinkron
				</Button>
			</div>

			{/* KONTEN DATA */}
			{isLoading ? (
				<div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
					<FolderClock className="w-12 h-12 mb-4 animate-pulse opacity-50" />
					<p>Memuat rekam jejak kolam...</p>
				</div>
			) : filteredEvents.length === 0 ? (
				<Card className="border-dashed shadow-none bg-muted/20">
					<CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
						<History className="w-12 h-12 mb-4 opacity-20" />
						<h3 className="text-lg font-semibold">Tidak ada data ditemukan</h3>
						<p className="text-sm">
							Cobalah ubah filter atau jalankan pertandingan terlebih dahulu.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-8">
					{filteredEvents.map((ev) => (
						<Card key={ev.id} className="shadow-sm p-0 gap-0">
							<CardHeader className="sticky top-[60px] sm:top-[68px] z-30 bg-slate-50 dark:bg-slate-900 border-b pt-6 rounded-t-xl shadow-sm">
								<CardTitle className="text-xl">
									{ev.eventName}{" "}
									<span className="text-muted-foreground font-normal ml-2">
										| {ev.distanceStyle} ({ev.gender})
									</span>
								</CardTitle>
								<CardDescription>Kategori Umur: {ev.ageGroup}</CardDescription>
							</CardHeader>

							<CardContent className="p-0">
								{ev.heats.map((ht) => (
									<div key={ht.id} className="border-b last:border-b-0">
										<div className="sticky top-[152px] sm:top-[160px] z-20 px-6 pt-7 pb-3 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-md flex justify-between items-center border-b shadow-sm">
											<div className="font-semibold text-sm flex items-center gap-2">
												Seri (Heat) {ht.label}
												<Badge
													variant="outline"
													className={`text-[10px] uppercase ${
														ht.status === "FINISHED"
															? "text-green-600 border-green-200"
															: ht.status === "RUNNING"
																? "text-blue-600 border-blue-200"
																: ""
													}`}
												>
													{ht.status}
												</Badge>
											</div>
											<div className="flex items-center gap-3">
												{(ht.status === "FINISHED" ||
													ht.status === "STOPPED") && (
													<Button
														variant="outline"
														size="sm"
														className="h-7 text-xs bg-white dark:bg-slate-950"
														onClick={() => printMutation.mutate(ht.id)}
														disabled={printMutation.isPending}
													>
														<Printer className="w-3 h-3 mr-2" />
														{printMutation.isPending
															? "Mencetak..."
															: "Print Struk"}
													</Button>
												)}
												<Badge
													variant={ht.isSynced ? "secondary" : "destructive"}
													className="text-[10px]"
												>
													{ht.isSynced ? "Tersinkronisasi" : "Belum Sinkron"}
												</Badge>
											</div>
										</div>

										<div className="px-6 py-2 overflow-x-auto">
											<Table>
												<TableHeader>
													<TableRow className="hover:bg-transparent">
														<TableHead className="w-[60px] text-center">
															Lintasan
														</TableHead>
														<TableHead>Atlet</TableHead>
														<TableHead>Klub</TableHead>
														<TableHead>Peringkat</TableHead>
														<TableHead className="text-right">
															Waktu Final
														</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{ht.lanes.length === 0 ? (
														<TableRow>
															<TableCell
																colSpan={5}
																className="text-center text-muted-foreground h-12"
															>
																Tidak ada atlet di seri ini.
															</TableCell>
														</TableRow>
													) : (
														[...ht.lanes]
															.sort((a, b) => {
																if (a.status !== "OK" && b.status === "OK")
																	return 1;
																if (a.status === "OK" && b.status !== "OK")
																	return -1;
																if (!a.finalTimeMillis) return 1;
																if (!b.finalTimeMillis) return -1;
																return a.finalTimeMillis - b.finalTimeMillis;
															})
															.map((lane, index) => {
																const isFinishedOk =
																	lane.status === "OK" && lane.finalTimeMillis;
																const rank = isFinishedOk ? index + 1 : "-";

																return (
																	<TableRow
																		key={lane.id}
																		className={
																			lane.status !== "OK"
																				? "bg-red-50/50 dark:bg-red-950/20"
																				: ""
																		}
																	>
																		<TableCell className="text-center font-bold">
																			{lane.laneNumber}
																		</TableCell>
																		<TableCell className="font-medium">
																			{lane.athleteName}
																			{lane.status !== "OK" && (
																				<Badge
																					variant="destructive"
																					className="ml-2 text-[10px] h-4 py-0"
																				>
																					{lane.status}
																				</Badge>
																			)}
																		</TableCell>
																		<TableCell className="text-muted-foreground text-xs">
																			{lane.clubName || "-"}
																		</TableCell>
																		<TableCell className="text-center font-bold text-blue-600 dark:text-blue-400">
																			{rank !== "-" ? `#${rank}` : "-"}
																		</TableCell>
																		<TableCell className="text-right font-mono font-bold text-sm">
																			{lane.finalTime ? (
																				<span className="flex items-center justify-end gap-2 text-green-600 dark:text-green-400">
																					{lane.finalTime}
																					<Clock className="w-3 h-3" />
																				</span>
																			) : (
																				"-"
																			)}
																		</TableCell>
																	</TableRow>
																);
															})
													)}
												</TableBody>
											</Table>
										</div>
									</div>
								))}
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* --- DANGER ZONE --- */}
			<div className="pt-20 pb-10">
				<Card className="border-red-200 bg-red-50/30 dark:border-red-900/50 dark:bg-red-950/20 shadow-none">
					<CardContent className="flex flex-col md:flex-row items-center justify-between p-6 gap-4">
						<div>
							<h3 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
								<AlertTriangle className="w-5 h-5" /> Danger Zone
							</h3>
							<p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
								Hapus seluruh riwayat pertandingan, heat, dan lane dari database
								lokal. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
							</p>
						</div>
						<Button
							variant="destructive"
							onClick={() => setIsWipeModalOpen(true)}
							className="whitespace-nowrap"
						>
							<Trash2 className="w-4 h-4 mr-2" /> Wipe Database
						</Button>
					</CardContent>
				</Card>
			</div>

			{/* MODAL KONFIRMASI BERLAPIS (Custom Overlay) */}
			{isWipeModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
					<div className="bg-background rounded-xl shadow-lg w-full max-w-md border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
						<div className="p-6 space-y-4">
							<div className="flex items-center gap-3 text-destructive">
								<AlertTriangle className="w-8 h-8" />
								<h2 className="text-xl font-bold">Peringatan Kritis!</h2>
							</div>
							<p className="text-sm text-muted-foreground">
								Anda akan menghapus <strong>SEMUA DATA</strong> pertandingan di
								database lokal. Jika belum disinkronkan, data ini akan hilang
								selamanya.
							</p>

							<div className="space-y-4 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-900/50">
								{/* Lapis 1: Checkbox */}
								<label className="flex items-start gap-3 cursor-pointer">
									<input
										type="checkbox"
										className="mt-1 w-4 h-4 accent-red-600"
										checked={wipeCheckbox}
										onChange={(e) => setWipeCheckbox(e.target.checked)}
									/>
									<span className="text-sm font-medium text-red-900 dark:text-red-200">
										Saya sadar bahwa tindakan ini permanen dan tidak bisa
										dibatalkan.
									</span>
								</label>

								{/* Lapis 2: Teks Konfirmasi */}
								<div className="space-y-2 pt-2 border-t border-red-200 dark:border-red-900/50">
									<p className="text-sm font-medium text-red-900 dark:text-red-200">
										Ketik{" "}
										<span className="font-mono font-bold bg-white dark:bg-black px-1 rounded select-all">
											HAPUS SEMUA DATA
										</span>{" "}
										untuk melanjutkan:
									</p>
									<Input
										value={wipeTextConfirm}
										onChange={(e) => setWipeTextConfirm(e.target.value)}
										placeholder="HAPUS SEMUA DATA"
										className="border-red-300 focus-visible:ring-red-500 font-mono"
									/>
								</div>
							</div>
						</div>

						<div className="flex items-center justify-end gap-3 p-4 bg-muted/50 border-t">
							<Button
								variant="outline"
								onClick={() => {
									setIsWipeModalOpen(false);
									setWipeTextConfirm("");
									setWipeCheckbox(false);
								}}
								disabled={wipeMutation.isPending}
							>
								Batal
							</Button>
							<Button
								variant="destructive"
								disabled={
									!wipeCheckbox ||
									wipeTextConfirm !== "HAPUS SEMUA DATA" ||
									wipeMutation.isPending
								}
								onClick={() => wipeMutation.mutate()}
							>
								{wipeMutation.isPending ? "Menghapus..." : "Ya, Hapus Permanen"}
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
