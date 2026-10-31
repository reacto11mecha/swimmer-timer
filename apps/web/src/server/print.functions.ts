// apps/web/src/server/print.functions.ts
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

			// 4. Siapkan format tanggal & waktu (FORCE WIB / ASIA/JAKARTA)
			const now = new Date();
			const dateStr = now.toLocaleDateString("id-ID", {
				timeZone: "Asia/Jakarta", // Paksa ke waktu Jakarta
				weekday: "short",
				day: "2-digit",
				month: "short",
				year: "numeric",
			});
			const timeStr = now.toLocaleTimeString("id-ID", {
				timeZone: "Asia/Jakarta", // Paksa ke waktu Jakarta
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			});
			const printDate = `${dateStr} - ${timeStr} WIB`;

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

							// TENTUKAN DISPLAY LANE SECARA DINAMIS
							let displayLane = lane.laneNumber.toString();
							if (lane.groupLabel) {
								let localLaneNum = lane.laneNumber;
								const group = lane.groupLabel.toUpperCase();

								// Sesuaikan kembali posisi fisik (kolom 4-6 jadi 1-3, dst)
								if (group === "B") localLaneNum -= 3;
								else if (group === "C") localLaneNum -= 6;

								displayLane = `${localLaneNum}${group}`; // Cth: "1A", "2B"
							}

							// Kalkulasi lebar karakter (Total maksimal 32 karakter)
							// posStr = 4 karakter (misal: "#1  ")
							const posStr = `#${rank}`.padEnd(4, " ");

							// lnStr = 5 karakter (misal: "[1A] ")
							const lnStr = `[${displayLane}]`.padEnd(5, " ");

							// INTERSEPSI STATUS: Jika finalTime kosong dan status masih OK, ubah jadi DNS
							let timeVal = "-";
							if (lane.finalTime) {
								timeVal = lane.finalTime;
							} else {
								timeVal = lane.status === "OK" ? "DNS" : lane.status || "-";
							}

							// Sisa lebar karakter = 32 - (4 + 5) = 23 karakter
							const timePadded = timeVal.padStart(23, " ");

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
