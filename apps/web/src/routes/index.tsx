// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getHistoryData } from "@/server/history.functions";
import { printHeatResult } from "@/server/print.functions";

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
} from "lucide-react";

export const Route = createFileRoute("/")({
	component: DashboardHomePage,
});

function DashboardHomePage() {
	const [filter, setFilter] = useState<"ALL" | "SYNCED" | "UNSYNCED">("ALL");

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

			// KEMBALI KE 7 KOLOM (Sesuai Gambar)
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

					// HEADER 7 KOLOM
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

					// Baris Data Lintasan (Atlet)
					ht.lanes.forEach((lane) => {
						// LOGIKA GABUNGAN: Jika status bukan OK, tulis statusnya. Jika OK, tulis waktunya.
						let hasilAkhir = lane.finalTime || "-";
						if (lane.status !== "OK") {
							hasilAkhir = lane.status; // Akan mencetak "DNS", "DSQ", dll.
						}

						sheet.addRow([
							lane.laneNumber,
							lane.athleteName,
							lane.birthYear,
							lane.ageGroup,
							lane.clubName,
							lane.seedTime,
							hasilAkhir, // <-- Hanya 7 data yang dimasukkan
						]);
					});

					sheet.addRow([]);
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

	// Fungsi Dummy Sinkronisasi
	const handleSync = () => {
		toast.warning("Fungsi sinkronisasi cloud akan segera hadir!");
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
					<Button onClick={handleSync}>
						<CloudUpload className="w-4 h-4 mr-2" /> Sinkronisasi
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
														// Eksekusi mutasi saat diklik, kirimkan ID heat-nya
														onClick={() => printMutation.mutate(ht.id)}
														// Nonaktifkan tombol saat sedang proses mencetak
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
														// LOGIKA PERINGKAT:
														// Kita urutkan berdasarkan waktu (finalTimeMillis).
														// Yang statusnya bukan "OK" (misal DSQ/DNS) atau waktunya null, ditaruh di bawah.
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
																// Tentukan peringkat: Jika statusnya OK dan ada waktu, kasih nomor urut
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
		</div>
	);
}
