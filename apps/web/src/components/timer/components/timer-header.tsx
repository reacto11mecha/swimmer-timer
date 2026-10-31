// apps/web/src/components/timer/components/timer-header.tsx
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Activity,
	RotateCcw,
	AlertTriangle,
	ArrowRight,
	Printer,
	CloudUpload,
	Search,
	RefreshCw,
} from "lucide-react";
import { useTimerMutations } from "../hooks/use-timer-mutations";

import type { RaceState, Event, Heat, NextHeat, PendingHeats } from "../types";
import { formatTime } from "../utils";

interface Props {
	event?: Event;
	heat: Heat;
	nextHeat: NextHeat;
	raceState: RaceState;
	displayTime: number;
	pendingHeats: PendingHeats | undefined;
	serverEventId?: number | null;
	mutations: Omit<
		Omit<
			Omit<ReturnType<typeof useTimerMutations>, "handleForceStop">,
			"handleResetHardware"
		>,
		"handleCloudSync"
	>;
	handlers: {
		handleForceStop: () => void;
		handleResetHardware: () => void;
		handleCloudSync: () => void;
	};
}

export function TimerHeader({
	event,
	heat,
	nextHeat,
	raceState,
	displayTime,
	pendingHeats,
	serverEventId,
	mutations,
	handlers,
}: Props) {
	const {
		resetMutation,
		stopMutation,
		nextHeatMutation,
		printMutation,
		jumpToHeatMutation,
		refreshLanesMutation,
		syncToSpeedzoneMutation,
	} = mutations;

	const { handleForceStop, handleResetHardware, handleCloudSync } = handlers;

	return (
		<Card
			className={`border-t-4 shadow-sm transition-colors duration-300 ${
				raceState === "RUNNING"
					? "border-t-green-500"
					: raceState === "STOPPED" || raceState === "FINISHED"
						? "border-t-yellow-500"
						: "border-t-blue-600"
			}`}
		>
			<CardHeader className="flex flex-col pb-4 gap-4">
				<div className="flex flex-row justify-between md:items-start w-full">
					<div className="flex-1">
						<div className="flex items-center gap-2 mb-2">
							<Badge
								variant={raceState === "RUNNING" ? "default" : "secondary"}
							>
								{raceState === "READY" ? "WAITING GUN START" : raceState}
							</Badge>
							{raceState === "RUNNING" && (
								<Activity className="h-4 w-4 text-green-500 animate-pulse" />
							)}
						</div>
						<CardTitle className="text-3xl font-bold tracking-tight">
							{event?.eventName} - {event?.distanceStyle} ({event?.gender})
						</CardTitle>
						<p className="text-muted-foreground font-medium mt-1">
							Heat {heat.label} • Target: {heat.maxLaps} Lap
						</p>
					</div>

					<div className="text-right flex flex-col items-end gap-3 min-w-[280px]">
						<div>
							<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
								Waktu Resmi
							</p>
							<div
								className={`text-6xl font-mono font-bold tabular-nums tracking-tighter ${
									raceState === "RUNNING"
										? "text-green-600 dark:text-green-400"
										: ""
								}`}
							>
								{formatTime(displayTime)}
							</div>
						</div>
					</div>
				</div>

				<div className="flex flex-row w-full gap-3 items-center">
					{raceState !== "RUNNING" &&
						pendingHeats &&
						pendingHeats.length > 0 && (
							<div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 rounded-md p-1 border">
								<Search className="w-4 h-4 text-muted-foreground ml-2" />
								<Select
									key={heat?.id || "jump-select"}
									onValueChange={(val) =>
										jumpToHeatMutation.mutate(Number(val))
									}
									disabled={jumpToHeatMutation.isPending}
								>
									<SelectTrigger className="w-full h-8 text-sm border-0 bg-transparent focus:ring-0 shadow-none">
										<SelectValue placeholder="Lompat ke Seri..." />
									</SelectTrigger>
									<SelectContent>
										{pendingHeats.map((ph) => (
											<SelectItem key={ph.id} value={ph.id.toString()}>
												Heat {ph.label} ({ph.event?.eventName})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}

					<Button
						variant="outline"
						className="h-12 justify-start text-blue-600 hover:text-blue-700"
						disabled={
							refreshLanesMutation.isPending ||
							raceState === "RUNNING" ||
							!serverEventId
						}
						onClick={() =>
							serverEventId && refreshLanesMutation.mutate(serverEventId)
						}
					>
						<RefreshCw
							className={`w-3 h-3 mr-2 ${
								refreshLanesMutation.isPending ? "animate-spin" : ""
							}`}
						/>
						{refreshLanesMutation.isPending
							? "Menarik data..."
							: "Tarik Data Lintasan Baru"}
					</Button>

					{/*{(raceState === "FINISHED" || raceState === "STOPPED") && (
						<Button
							variant="default"
							className="h-12 justify-start bg-blue-600 hover:bg-blue-700 text-white"
							onClick={handleCloudSync}
							disabled={syncToSpeedzoneMutation.isPending}
						>
							<CloudUpload
								className={`w-3 h-3 mr-2 ${
									syncToSpeedzoneMutation.isPending ? "animate-bounce" : ""
								}`}
							/>
							{syncToSpeedzoneMutation.isPending
								? "Mengunggah..."
								: "Simpan Hasil ke Cloud"}
						</Button>
					)}*/}
				</div>
			</CardHeader>

			<CardContent className="flex flex-wrap gap-3 pt-4 border-t bg-slate-50/50 dark:bg-slate-900/20">
				<Button
					size="lg"
					variant="secondary"
					className="w-48"
					onClick={handleResetHardware}
					disabled={
						raceState === "RUNNING" ||
						raceState === "FINISHED" ||
						resetMutation.isPending
					}
				>
					<RotateCcw className="mr-2 h-5 w-5" />
					{resetMutation.isPending ? "Mereset..." : "Reset Seri"}
				</Button>

				<Button
					size="lg"
					variant="destructive"
					className="w-48"
					disabled={raceState !== "RUNNING" || stopMutation.isPending}
					onClick={handleForceStop}
				>
					<AlertTriangle className="mr-2 h-5 w-5" />
					{stopMutation.isPending ? "Menghentikan..." : "Force Stop"}
				</Button>

				<Button
					size="lg"
					variant="outline"
					className="w-48 bg-white dark:bg-slate-950"
					disabled={
						(raceState !== "FINISHED" && raceState !== "STOPPED") ||
						printMutation.isPending
					}
					onClick={() => printMutation.mutate(heat.id)}
				>
					<Printer className="mr-2 h-5 w-5" />
					{printMutation.isPending ? "Mencetak..." : "Print Struk"}
				</Button>

				<div className="flex-1"></div>

				<Button
					size="lg"
					className={`transition-all duration-500 ${
						raceState === "FINISHED" && nextHeat
							? "bg-green-600 hover:bg-green-700 animate-pulse text-white shadow-lg shadow-green-500/30"
							: ""
					}`}
					disabled={
						raceState === "RUNNING" || nextHeatMutation.isPending || !nextHeat
					}
					onClick={() => {
						if (raceState === "FINISHED" || raceState === "STOPPED") {
							handleCloudSync();
						}

						nextHeatMutation.mutate();
					}}
				>
					{nextHeatMutation.isPending ? (
						"Memuat..."
					) : nextHeat ? (
						<>
							Lanjut: {nextHeat.eventName} Heat {nextHeat.label}
							<ArrowRight className="ml-2 h-5 w-5 shrink-0" />
						</>
					) : (
						"Tidak Ada Seri Lanjutan"
					)}
				</Button>
			</CardContent>
		</Card>
	);
}
