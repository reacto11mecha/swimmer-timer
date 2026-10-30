// apps/web/src/components/timer/components/activity-log-table.tsx
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { History } from "lucide-react";

import type { ActivityLog } from "../types";

interface Props {
	logs: ActivityLog[];
}

export function ActivityLogTable({ logs }: Props) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-lg flex items-center gap-2">
					<History className="h-5 w-5" /> Log Aktivitas Lomba
				</CardTitle>
				<CardDescription>
					Catatan sinkronisasi sensor dan riwayat perlombaan.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="rounded-md border max-h-[300px] overflow-y-auto bg-slate-50 dark:bg-slate-950">
					<Table>
						<TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-950 shadow-sm z-10">
							<TableRow>
								<TableHead className="w-[100px]">Waktu</TableHead>
								<TableHead>Aktivitas</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{logs.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={2}
										className="text-center text-muted-foreground h-16"
									>
										Menunggu perlombaan dimulai...
									</TableCell>
								</TableRow>
							) : (
								logs.map((log) => (
									<TableRow key={log.id}>
										<TableCell className="font-mono text-xs text-muted-foreground align-top">
											{log.time}
										</TableCell>
										<TableCell>
											<span
												className={`text-sm font-medium ${
													log.type === "success"
														? "text-green-600 dark:text-green-400"
														: log.type === "destructive"
															? "text-red-600 dark:text-red-400"
															: log.type === "warning"
																? "text-yellow-600 dark:text-yellow-500"
																: "text-slate-700 dark:text-slate-300"
												}`}
											>
												{log.message}
											</span>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}
