import mqtt from "mqtt";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, count } from "drizzle-orm";
import "dotenv/config";

import { heats, laneAssignments, lapTimes } from "@swimmer-timer/db/schema";

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  const fract = Math.floor((ms % 1000) / 10)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}.${fract}`;
};

// 1. Setup Koneksi Database
const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://loremipsum:loremipsum@127.0.0.1:5455/loremipsum",
});
const db = drizzle(pool, { schema: { heats, laneAssignments, lapTimes } });

// 2. Setup Koneksi MQTT
const MQTT_BROKER = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const client = mqtt.connect(MQTT_BROKER);

client.on("connect", () => {
  console.log("[MQTT Worker] Terhubung ke broker");

  // Menyesuaikan dengan topik yang ditembakkan oleh UI dan ESP32 terbaru
  client.subscribe("swimtimer/evt/start");
  client.subscribe("swimtimer/evt/lap");
  client.subscribe("swimtimer/cmd/stop");
});

client.on("message", async (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());

    switch (topic) {
      case "swimtimer/evt/start":
        await handleStarterStart();
        break;
      case "swimtimer/evt/lap":
        await handleTimerLap(payload);
        break;
      case "swimtimer/cmd/stop":
        await handleForceStop();
        break;
    }
  } catch (err) {
    console.error("[MQTT Worker] Gagal memproses pesan:", err);
  }
});

// ==========================================
// HANDLER: PISTOL START (GUN)
// ==========================================
async function handleStarterStart() {
  const readyHeat = await db.query.heats.findFirst({
    where: eq(heats.status, "CURRENT"),
  });

  if (readyHeat) {
    await db
      .update(heats)
      .set({
        status: "RUNNING",
        startedAt: new Date(),
        // hardwareStartMillis tidak lagi krusial, tapi bisa diset null/0
        // karena kalkulasi waktu sudah diambil alih 100% oleh ESP32
      })
      .where(eq(heats.id, readyHeat.id));

    console.log(`[MQTT] Gun Fired! Heat ${readyHeat.label} -> RUNNING.`);
  } else {
    console.warn("[MQTT] Sinyal pistol diterima, tapi tidak ada Heat CURRENT.");
  }
}

// ==========================================
// HANDLER: TOUCHPAD / LAPPING LINTASAN
// ==========================================
async function handleTimerLap(payload: { lane: number; elapsed_ms: number }) {
  const { lane, elapsed_ms } = payload;

  // 1. Pastikan ada heat yang sedang berjalan
  const runningHeat = await db.query.heats.findFirst({
    where: eq(heats.status, "RUNNING"),
  });

  if (!runningHeat) return;

  // 2. Cari data peserta di lintasan tersebut pada heat ini
  const assignment = await db.query.laneAssignments.findFirst({
    where: and(
      eq(laneAssignments.heatId, runningHeat.id),
      eq(laneAssignments.laneNumber, lane),
    ),
  });

  if (!assignment) return;

  // Jika peserta ini sudah finish atau didiskualifikasi, abaikan sentuhan ekstra
  if (assignment.finalTimeMillis || assignment.status !== "OK") return;

  // 3. Tentukan urutan Lap dengan menghitung data yang sudah ada di database
  const existingLaps = await db
    .select({ count: count() })
    .from(lapTimes)
    .where(eq(lapTimes.laneAssignmentId, assignment.id));

  const currentLapOrder = Number(existingLaps[0].count) + 1;
  const splitTimeDisplay = formatTime(elapsed_ms);

  // 4. Simpan catatan lap
  await db.insert(lapTimes).values({
    laneAssignmentId: assignment.id,
    lapNumber: currentLapOrder,
    splitTime: splitTimeDisplay,      // Waktu per lap (sebagai referensi)
    cumulativeTime: splitTimeDisplay, // Total waktu dari start
    rawMillis: elapsed_ms,
  });

  // 5. Cek apakah batas lap sudah tercapai (Finish)
  if (currentLapOrder >= runningHeat.maxLaps) {
    await db
      .update(laneAssignments)
      .set({
        finalTimeMillis: elapsed_ms,
        finalTime: splitTimeDisplay,
      })
      .where(eq(laneAssignments.id, assignment.id));

    console.log(`[MQTT] Lane ${lane} FINISH di ${splitTimeDisplay}`);

    // Opsional: Cek apakah SEMUA lintasan sudah finish, jika iya ubah heat ke FINISHED
    await checkAllLanesFinished(runningHeat.id);
  } else {
    console.log(`[MQTT] Lane ${lane} Lap ${currentLapOrder} di ${splitTimeDisplay}`);
  }
}

// ==========================================
// HANDLER: FORCE STOP / FINISH
// ==========================================
async function handleForceStop() {
  const runningHeat = await db.query.heats.findFirst({
    where: eq(heats.status, "RUNNING"),
  });

  if (runningHeat) {
    await db
      .update(heats)
      .set({ status: "FINISHED" })
      .where(eq(heats.id, runningHeat.id));
    console.log(`[MQTT] Lomba dihentikan paksa. Heat status -> FINISHED.`);
  }
}

// ==========================================
// HELPER: CEK SEMUA LINTASAN SELESAI
// ==========================================
async function checkAllLanesFinished(heatId: number) {
  const allLanes = await db.query.laneAssignments.findMany({
    where: eq(laneAssignments.heatId, heatId),
  });

  // Jika semua lintasan yang statusnya "OK" sudah memiliki finalTimeMillis
  const allFinished = allLanes
    .filter(l => l.status === "OK")
    .every(l => l.finalTimeMillis !== null);

  if (allFinished) {
    await db
      .update(heats)
      .set({ status: "FINISHED" })
      .where(eq(heats.id, heatId));
    console.log(`[MQTT] Semua perenang selesai. Heat otomatis ditutup (FINISHED).`);
  }
}
