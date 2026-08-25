import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { events, heats, laneAssignments } from "@swimmer-timer/db/schema";
import escpos from "escpos";
import fs from "fs";

const PRINTER_PATH = "/dev/usb/lp0";

export const printHeatResult = createServerFn({ method: "POST" })
	.validator(z.object({ heatId: z.number() }))
	.handler(async ({ data }) => {
		try {
			// 1. Ambil data Heat dan Event
			const heat = await db.query.heats.findFirst({
				where: eq(heats.id, data.heatId),
			});
			if (!heat) throw new Error("Heat tidak ditemukan.");

			const event = await db.query.events.findFirst({
				where: eq(events.id, heat.eventId),
			});
			if (!event) throw new Error("Acara tidak ditemukan.");

			// 2. Ambil data Lane
			const lanes = await db.query.laneAssignments.findMany({
				where: eq(laneAssignments.heatId, heat.id),
			});

			// 3. Urutkan Lane (Peringkat Juara)
			const sortedLanes = [...lanes].sort((a, b) => {
				if (a.status !== "OK" && b.status === "OK") return 1;
				if (a.status === "OK" && b.status !== "OK") return -1;
				if (!a.finalTimeMillis) return 1;
				if (!b.finalTimeMillis) return -1;
				return (a.finalTimeMillis ?? 0) - (b.finalTimeMillis ?? 0);
			});

			// 4. Siapkan format tanggal & waktu
			const now = new Date();
			const dateStr = now.toLocaleDateString("id-ID", {
				weekday: "short",
				day: "2-digit",
				month: "short",
				year: "numeric",
			});
			const timeStr = now.toLocaleTimeString("id-ID", {
				hour: "2-digit",
				minute: "2-digit",
			});
			const printDate = `${dateStr} - ${timeStr}`;

			// 5. Bypass Native Device Adapter
			let fd: number | null = null;

			// Kita beri tahu TypeScript bahwa ini mematuhi aturan escpos.Adapter
			// dan memiliki tambahan fungsi close() yang dibutuhkan oleh printer.close()
			const device: escpos.Adapter & {
				close: (cb?: (err?: Error | null) => void) => void;
			} = {
				open: function (callback?: (err?: Error | null) => void) {
					try {
						fd = fs.openSync(PRINTER_PATH, "w");
						if (callback) callback(null);
					} catch (err: any) {
						if (callback) callback(err);
					}
					return this; // <--- WAJIB ADA agar TypeScript tidak mengamuk
				},
				write: function (
					data: Buffer,
					callback?: (err?: Error | null) => void,
				) {
					try {
						if (fd !== null) fs.writeSync(fd, data);
						if (callback) callback(null);
					} catch (err: any) {
						if (callback) callback(err);
					}
					return this; // <--- WAJIB ADA agar TypeScript tidak mengamuk
				},
				close: function (callback?: (err?: Error | null) => void) {
					try {
						if (fd !== null) {
							fs.closeSync(fd);
							fd = null;
						}
						if (callback) callback(null);
					} catch (err: any) {
						if (callback) callback(err);
					}
				},
			};

			// 6. Eksekusi Print
			return new Promise<{ success: boolean; message: string }>(
				(resolve, reject) => {
					// Inisialisasi printer dengan width 32 karakter (standar 58mm)
					const printer = new escpos.Printer(device, {
						encoding: "GB18030",
					});

					device.open((error: any) => {
						if (error) {
							reject(
								new Error(
									"Gagal membuka port printer. Pastikan printer menyala dan path /dev/usb/lp0 benar.",
								),
							);
							return;
						}

						printer
							.align("CT")
							.style("B")
							.text("================================")
							.text("          HASIL LOMBA           ")
							.text("================================")
							.align("LT")
							.style("NORMAL")
							.text(event.eventName)
							.text(`${event.distanceStyle} (${event.gender})`)
							.text(`KU: ${event.ageGroup}`)
							.text(`Seri: ${heat.label}`)
							.text(printDate)
							.text("--------------------------------")
							.style("B")
							.text("Pos Ln                     Waktu")
							.text("--------------------------------")
							.style("NORMAL");

						// Cetak masing-masing atlet dengan format Top-Heavy
						sortedLanes.forEach((lane, index) => {
							const isFinishedOk = lane.status === "OK" && lane.finalTimeMillis;
							const rank = isFinishedOk ? `${index + 1}` : "-";

							// Baris 1: Peringkat, Lane, dan Waktu (total 32 karakter)
							const posStr = `#${rank}`.padEnd(4, " "); // misal: "#1  "
							const lnStr = `[${lane.laneNumber}]`.padEnd(4, " "); // misal: "[4] "
							const timeVal = lane.finalTime || lane.status || "-";
							const timePadded = timeVal.padStart(24, " "); // Waktu rata kanan

							printer
								.style("B")
								.text(`${posStr}${lnStr}${timePadded}`)
								.style("NORMAL")
								.text(lane.athleteName || "KOSONG")
								.text(lane.clubName || "-")
								.text(""); // Baris kosong pembatas antar atlet
						});

						printer
							.text("--------------------------------")
							.align("CT")
							.text("      --- TERIMA KASIH ---      ")
							.feed(5) // Gulung kertas 5 baris agar tidak tenggelam
							.close();

						resolve({ success: true, message: "Berhasil mencetak struk!" });
					});
				},
			);
		} catch (error: any) {
			throw new Error(
				error.message || "Terjadi kesalahan saat memproses data.",
			);
		}
	});
