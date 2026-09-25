import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

import {
	activateHeat,
	getRunningHeat,
	getPendingHeats,
	updateHeatMaxLaps,
} from "@/server/heat.functions";
import { insertBukuAcaraData } from "@/server/excel.functions";
import {
	getCompetitions,
	getEventsByCompetition,
	getStartingList,
} from "@/server/speedzone.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Play,
	Save,
	CheckCircle2,
	Upload,
	FileSpreadsheet,
	RefreshCw,
	CloudDownload,
	Globe,
} from "lucide-react";

export const Route = createFileRoute("/preparation")({
	component: PreparationPage,
});

function PreparationPage() {
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [maxLapsInput, setMaxLapsInput] = useState<number | string>("");

	// Speedzone State
	const [selectedCompId, setSelectedCompId] = useState<number | null>(null);
	const [isSyncing, setIsSyncing] = useState(false);

	// ==========================================
	// FETCH DATA (GET)
	// ==========================================
	const { data: runningHeat, isLoading: isRunningLoading } = useQuery({
		queryKey: ["runningHeat"],
		queryFn: () => getRunningHeat(),
	});

	const { data: pendingHeats = [], isLoading: isPendingLoading } = useQuery({
		queryKey: ["pendingHeats"],
		queryFn: () => getPendingHeats(),
	});

	// Fetch Daftar Kompetisi dari Speedzone
	const { data: competitions, isLoading: loadingComps } = useQuery({
		queryKey: ["speedzone", "competitions"],
		queryFn: () => getCompetitions(),
	});

	// ==========================================
	// MUTASI SERVER (POST / PUT)
	// ==========================================

	// 1. Mutasi Upload Excel (Existing)
	const uploadMutation = useMutation({
		mutationFn: (jsonData: any) => insertBukuAcaraData({ data: jsonData }),
		onSuccess: (res) => {
			toast.success(res.message);
			queryClient.invalidateQueries({ queryKey: ["runningHeat"] });
			queryClient.invalidateQueries({ queryKey: ["pendingHeats"] });
			if (fileInputRef.current) fileInputRef.current.value = "";
		},
		onError: (err: any) => {
			toast.error(`Gagal menyimpan ke database: ${err.message}`);
		},
	});

	// 2. Mutasi Sinkronisasi Speedzone (Baru)
	const syncSpeedzoneMutation = useMutation({
		// Kita menggunakan format JSON yang sama seperti Excel agar bisa di-reuse oleh insertBukuAcaraData
		mutationFn: (jsonData: any) => insertBukuAcaraData({ data: jsonData }),
		onSuccess: (res) => {
			toast.success("Sinkronisasi Speedzone berhasil!");
			queryClient.invalidateQueries({ queryKey: ["runningHeat"] });
			queryClient.invalidateQueries({ queryKey: ["pendingHeats"] });
		},
		onError: (err: any) => {
			toast.error(`Gagal menyimpan data Speedzone: ${err.message}`);
		},
	});

	const activateMutation = useMutation({
		mutationFn: (heatId: number) =>
			activateHeat({ data: { heatDbId: heatId } }),
		onSuccess: (res) => {
			toast.success(res.message);
			queryClient.invalidateQueries({ queryKey: ["runningHeat"] });
			queryClient.invalidateQueries({ queryKey: ["pendingHeats"] });
		},
		onError: (err: any) => {
			toast.error(`Error mengaktifkan heat: ${err.message}`);
		},
	});

	const updateLapsMutation = useMutation({
		mutationFn: (payload: { heatId: number; maxLaps: number }) =>
			updateHeatMaxLaps({ data: payload }),
		onSuccess: (res) => {
			toast.success(res.message);
			queryClient.invalidateQueries({ queryKey: ["runningHeat"] });
			queryClient.invalidateQueries({ queryKey: ["pendingHeats"] });
		},
		onError: (err: any) => {
			toast.error(`Gagal menyimpan: ${err.message}`);
		},
	});

	// ==========================================
	// HANDLER FUNGSI
	// ==========================================

	// Handler Sync Speedzone
	const handleSyncFromSpeedzone = async () => {
		if (!selectedCompId) return;
		setIsSyncing(true);

		try {
			toast.info("Menarik data event dari Speedzone...");
			const eventsResponse = await getEventsByCompetition({
				data: selectedCompId,
			});
			const eventsData = eventsResponse.data; // Asumsi response Speedzone punya { data: [...] }

			const parsedEvents: any[] = [];

			for (const event of eventsData) {
				const startListResponse = await getStartingList({ data: event.id });
				const startListData = startListResponse.data;

				if (!startListData || !startListData.heats) continue;

				// Transformasi format Speedzone ke format JSON internal kita
				const formattedEvent = {
					server_event_id: startListData.id, // ID server external
					eventName: startListData.name,
					ageGroup: "Semua Umur", // Fallback jika tidak ada di API
					distanceStyle: startListData.name, // Gunakan nama event sebagai style
					gender: "Campuran", // Fallback
					heats: [] as any[],
				};

				for (const heat of startListData.heats) {
					// Hitung maxLaps (sama seperti logika Excel)
					let maxLaps = 1;
					const match = formattedEvent.distanceStyle.match(/(\d+)/);
					if (match && match[1]) {
						maxLaps = Math.ceil(parseInt(match[1], 10) / 100);
					}

					const formattedHeat = {
						server_heat_id: heat.id,
						label: heat.heat_number,
						maxLaps: maxLaps,
						lanes: [] as any[],
					};

					for (const lane of heat.lanes) {
						if (!lane.participant) continue;

						formattedHeat.lanes.push({
							server_participant_id: lane.id, // Ini adalah heat_lane_id yang diminta Speedzone
							laneNumber: lane.lane,
							athleteName: lane.participant.name,
							birthYear: lane.participant.birth_year?.toString() || "-",
							ageGroup: "-",
							clubName: lane.participant.club || "-",
							seedTime: lane.participant.best_record || "NT",
						});
					}

					if (formattedHeat.lanes.length > 0) {
						formattedEvent.heats.push(formattedHeat);
					}
				}

				if (formattedEvent.heats.length > 0) {
					parsedEvents.push(formattedEvent);
				}
			}

			if (parsedEvents.length === 0) {
				throw new Error(
					"Tidak ada data jadwal (starting list) yang ditemukan di kompetisi ini.",
				);
			}

			toast.info("Mengirim struktur data Speedzone ke database lokal...");
			syncSpeedzoneMutation.mutate(parsedEvents);
		} catch (error: any) {
			toast.error(`Gagal sinkronisasi: ${error.message}`);
		} finally {
			setIsSyncing(false);
		}
	};

	// Handler Upload File Excel
	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		toast.info("Sedang membaca Excel di peramban...");

		try {
			const ExcelJS = (await import("exceljs")).default;
			const buffer = await file.arrayBuffer();
			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.load(buffer);
			const worksheet = workbook.worksheets[0];

			if (!worksheet) throw new Error("Tidak ada sheet yang ditemukan.");

			const parsedEvents: any[] = [];
			let currentEvent: any = null;
			let currentHeat: any = null;

			worksheet.eachRow((row) => {
				const col1 = row.getCell(1).text?.trim();
				if (!col1) return;

				if (col1.startsWith("ACARA")) {
					currentEvent = {
						eventName: col1,
						ageGroup: row.getCell(2).text?.trim() || "-",
						distanceStyle: row.getCell(4).text?.trim() || "-",
						gender: row.getCell(7).text?.trim() || "-",
						heats: [],
					};
					parsedEvents.push(currentEvent);
					currentHeat = null;
				} else if (col1.startsWith("Seri")) {
					if (!currentEvent)
						throw new Error("Format error: Ditemukan Seri tanpa label Acara.");

					const label = parseInt(col1.replace("Seri", "").trim(), 10);
					let maxLaps = 1;
					const match = currentEvent.distanceStyle.match(/(\d+)/);
					if (match && match[1]) {
						maxLaps = Math.ceil(parseInt(match[1], 10) / 100);
					}

					currentHeat = { label, maxLaps, lanes: [] };
					currentEvent.heats.push(currentHeat);
				} else {
					const laneNum = parseInt(col1, 10);
					if (!isNaN(laneNum) && currentHeat) {
						const athleteName = row.getCell(2).text?.trim();
						if (athleteName && athleteName !== "Nama") {
							currentHeat.lanes.push({
								laneNumber: laneNum,
								athleteName: athleteName,
								birthYear: row.getCell(3).text?.trim() || "-",
								ageGroup: row.getCell(4).text?.trim() || "-",
								clubName: row.getCell(5).text?.trim() || "-",
								seedTime: row.getCell(6).text?.trim() || "-",
							});
						}
					}
				}
			});

			if (parsedEvents.length === 0)
				throw new Error("Data valid tidak ditemukan di Excel.");

			toast.info("Mengirim data terstruktur ke server...");
			uploadMutation.mutate(parsedEvents);
		} catch (error: any) {
			toast.error(`Gagal mengurai Excel: ${error.message}`);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const handleUpdateLaps = () => {
		if (!runningHeat) return;
		updateLapsMutation.mutate({
			heatId: runningHeat.id,
			maxLaps: parseInt(maxLapsInput as string),
		});
	};

	useEffect(() => {
		if (runningHeat && !maxLapsInput) {
			setMaxLapsInput(runningHeat.maxLaps);
		}
	}, [runningHeat]);

	return (
		<div className="container mx-auto p-6 max-w-5xl space-y-8">
			{/* HEADER HALAMAN */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Persiapan Kompetisi
					</h1>
					<p className="text-muted-foreground mt-1">
						Pantau dan atur antrean pertandingan menggunakan data eksternal atau
						lokal.
					</p>
				</div>
			</div>

			{/* TAB SISTEM (SPEEDZONE VS EXCEL) */}
			<Tabs defaultValue="speedzone" className="w-full">
				<TabsList className="grid w-full grid-cols-2 mb-2">
					<TabsTrigger value="speedzone" className="flex items-center gap-2">
						<Globe className="w-4 h-4" /> Sinkronisasi Speedzone
					</TabsTrigger>
					<TabsTrigger value="excel" className="flex items-center gap-2">
						<FileSpreadsheet className="w-4 h-4" /> Upload Excel
					</TabsTrigger>
				</TabsList>

				{/* TAB: SPEEDZONE */}
				<TabsContent value="speedzone">
					<Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
						<CardContent className="pt-6">
							<div className="flex flex-col md:flex-row items-end gap-4">
								<div className="flex-1 space-y-2 w-full">
									<label className="text-sm font-medium text-blue-900 dark:text-blue-300">
										Pilih Kompetisi Speedzone Aktif
									</label>
									<Select
										onValueChange={(val) => setSelectedCompId(Number(val))}
										disabled={loadingComps}
									>
										<SelectTrigger className="w-full bg-white dark:bg-slate-950">
											<SelectValue
												placeholder={
													loadingComps
														? "Memuat kompetisi dari server..."
														: "Pilih kompetisi..."
												}
											/>
										</SelectTrigger>
										<SelectContent>
											{competitions?.data?.map((comp: any) => (
												<SelectItem key={comp.id} value={comp.id.toString()}>
													{comp.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<Button
									onClick={handleSyncFromSpeedzone}
									disabled={
										!selectedCompId ||
										isSyncing ||
										syncSpeedzoneMutation.isPending
									}
									className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white"
								>
									{isSyncing || syncSpeedzoneMutation.isPending ? (
										<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<CloudDownload className="mr-2 h-4 w-4" />
									)}
									Tarik Data API
								</Button>
							</div>
							<p className="text-xs text-blue-700/70 dark:text-blue-400/70 mt-3">
								*Menarik data dari Speedzone akan menimpa seluruh antrean lokal
								Anda. Lakukan ini hanya sebelum lomba dimulai atau jika ada
								perubahan jadwal mendadak ("Regenerate" oleh Admin).
							</p>
						</CardContent>
					</Card>
				</TabsContent>

				{/* TAB: EXCEL */}
				<TabsContent value="excel">
					<Card className="border-dashed">
						<CardContent className="pt-6 flex flex-col items-center justify-center py-8">
							<div className="relative">
								<Input
									type="file"
									accept=".xlsx, .xls"
									className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
									onChange={handleFileUpload}
									disabled={uploadMutation.isPending}
									ref={fileInputRef}
								/>
								<Button
									disabled={uploadMutation.isPending}
									variant="outline"
									className="relative z-0 pointer-events-none"
								>
									{uploadMutation.isPending ? (
										<Upload className="mr-2 h-4 w-4 animate-bounce" />
									) : (
										<FileSpreadsheet className="mr-2 h-4 w-4" />
									)}
									{uploadMutation.isPending
										? "Membaca Data..."
										: "Pilih File Excel Buku Acara"}
								</Button>
							</div>
							<p className="text-xs text-muted-foreground mt-3">
								Format yang didukung: .xlsx, .xls
							</p>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* KARTU UTAMA: HEAT BERJALAN (RUNNING) */}
			<Card className="shadow-sm">
				<CardHeader className="border-b border-green-100 dark:border-green-900/30">
					<div className="space-y-1">
						<CardTitle className="text-2xl flex items-center gap-3">
							Heat Aktif di Kolam
							<Badge
								className={`${
									runningHeat?.status === "PENDING"
										? "bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 text-white/75"
										: "bg-green-500 hover:bg-green-600 dark:bg-green-600 text-white"
								} shadow-sm border-0`}
							>
								{runningHeat?.status === "RUNNING" && (
									<span className="relative flex h-2 w-2 mr-2">
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
										<span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
									</span>
								)}
								{runningHeat?.status === "PENDING"
									? "WAITING GUN START"
									: runningHeat?.status}
							</Badge>
						</CardTitle>
						<CardDescription>
							Informasi detail terkait heat yang saat ini aktif tertaut ke
							perangkat keras.
						</CardDescription>
					</div>
				</CardHeader>

				<CardContent>
					{isRunningLoading ? (
						<p className="text-center py-6 text-muted-foreground">
							Memuat data aktif...
						</p>
					) : runningHeat ? (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mt-6">
							<div className="grid grid-cols-2 gap-y-4 text-sm bg-background/50 p-4 rounded-xl border">
								<div className="text-muted-foreground font-medium">Acara</div>
								<div className="font-semibold text-lg">
									{runningHeat.event.eventName}
								</div>

								<div className="text-muted-foreground font-medium">
									Gaya & Jarak
								</div>
								<div className="font-semibold text-lg">
									{runningHeat.event.distanceStyle}
								</div>

								<div className="text-muted-foreground font-medium">
									Kelompok / Gender
								</div>
								<div className="font-semibold">
									{runningHeat.event.ageGroup} - {runningHeat.event.gender}
								</div>

								<div className="text-muted-foreground font-medium mt-2">
									Nomor Seri
								</div>
								<div className="font-bold text-3xl text-primary mt-1">
									Heat {runningHeat.label}
								</div>
							</div>

							<div className="bg-muted/40 p-5 rounded-xl border space-y-4">
								<div>
									<label className="text-sm font-semibold flex items-center gap-2">
										<CheckCircle2 className="w-4 h-4 text-primary" /> Batas
										Maksimal Lap
									</label>
									<p className="text-xs text-muted-foreground mt-1">
										Atur kapan sistem harus mencatat waktu "Finish" akhir.
									</p>
								</div>
								<div className="flex items-center gap-3">
									<Input
										type="number"
										min={1}
										value={maxLapsInput}
										onChange={(e) => setMaxLapsInput(e.target.value)}
										className="max-w-[120px] text-lg font-bold text-center"
									/>
									<Button
										onClick={handleUpdateLaps}
										className="flex-1"
										disabled={updateLapsMutation.isPending}
									>
										<Save className="w-4 h-4 mr-2" /> Simpan Perubahan
									</Button>
								</div>
							</div>
						</div>
					) : (
						<div className="text-center py-10 text-muted-foreground">
							<p>
								Tidak ada heat yang di-set aktif ke perangkat keras saat ini.
							</p>
							<p className="text-sm mt-1">
								Silakan aktifkan heat dari daftar antrean di bawah.
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* DAFTAR HEAT (PENDING) */}
			<Card>
				<CardHeader>
					<CardTitle>Antrean Selanjutnya (PENDING)</CardTitle>
					<CardDescription>
						Pilih dan aktifkan heat selanjutnya.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isPendingLoading ? (
						<p className="text-center py-6 text-muted-foreground">
							Memuat antrean...
						</p>
					) : pendingHeats.length > 0 ? (
						<div className="rounded-md border overflow-hidden">
							<Table>
								<TableHeader className="bg-muted/50">
									<TableRow>
										<TableHead>Acara</TableHead>
										<TableHead>Gaya Lomba</TableHead>
										<TableHead>Kategori</TableHead>
										<TableHead>Heat</TableHead>
										<TableHead className="text-right">Aksi</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{pendingHeats.map((heat) => (
										<TableRow key={heat.id}>
											<TableCell className="font-medium">
												{heat.event.eventName}
											</TableCell>
											<TableCell>{heat.event.distanceStyle}</TableCell>
											<TableCell>
												{heat.event.ageGroup} {heat.event.gender}
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className="text-xs font-semibold"
												>
													Heat {heat.label}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<Button
													variant="secondary"
													size="sm"
													onClick={() => activateMutation.mutate(heat.id)}
													disabled={activateMutation.isPending}
												>
													<Play className="w-4 h-4 mr-2" /> Set Jadi Running
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : (
						<div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
							<p>Belum ada data pertandingan.</p>
							<p className="text-sm mt-1">
								Silakan pilih menu sinkronisasi di atas untuk memulai.
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
