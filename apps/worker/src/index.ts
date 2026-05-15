import mqtt from "mqtt";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, desc } from "drizzle-orm";
import "dotenv/config";

import * as schema from "@swimmer-timer/db/schema";
const { activeHeats, laneAssignments, lapTimes, nodeAssignments } = schema;

// 1. Setup Koneksi Database
const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://loremipsum:loremipsum@127.0.0.1:5455/loremipsum",
});
const db = drizzle(pool, { schema });

// 2. Setup Koneksi MQTT
const MQTT_BROKER = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const client = mqtt.connect(MQTT_BROKER);

client.on("connect", () => {
  console.log("✅ MQTT Worker terhubung ke broker:", MQTT_BROKER);

  client.subscribe("timer/start");
  client.subscribe("timer/lap");
});

client.on("message", async (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());

    if (topic === "timer/start") {
      await handleTimerStart(payload.elapsed);
    } else if (topic === "timer/lap") {
      await processLapTime(payload);
    }
  } catch (error) {
    console.error(`❌ Gagal memproses pesan di topik ${topic}:`, error);
  }
});

// ==========================================
// LOGIKA PEMROSESAN
// ==========================================

async function handleTimerStart(startMillis: number) {
  // Cari pertandingan yang sudah di-set "READY" oleh operator (status PENDING)
  const pendingHeat = await db.query.activeHeats.findFirst({
    where: eq(activeHeats.status, "PENDING"),
  });

  if (!pendingHeat) {
    console.warn("⚠️ Sinyal START diterima, tapi tidak ada sesi PENDING.");
    return;
  }

  // Ubah status jadi RUNNING dan simpan millis awal
  await db
    .update(activeHeats)
    .set({
      status: "RUNNING",
      startedAt: new Date(),
      hardwareStartMillis: startMillis,
    })
    .where(eq(activeHeats.id, pendingHeat.id));

  console.log(
    `⏱️ Pertandingan [${pendingHeat.eventTitle}] DIMULAI pada millis: ${startMillis}`,
  );
}

async function processLapTime(payload: {
  node: string; // Ini adalah 'nodeId' yang dikirim ESP32
  elapsed: number;
  lap_order: number;
}) {
  const { node, elapsed, lap_order } = payload;

  // 1. CARI MAPPING LINTASAN BERDASARKAN NODE ID
  // Kita cari lintasan berapa yang ditugaskan untuk node ini
  const nodeConfig = await db.query.nodeAssignments.findFirst({
    where: and(
      eq(nodeAssignments.nodeId, node),
      eq(nodeAssignments.isActive, true),
    ),
  });

  if (!nodeConfig) {
    console.warn(
      `⚠️ Menerima data dari node [${node}], tapi node tidak terdaftar/aktif di DB.`,
    );
    return;
  }

  const laneNumber = nodeConfig.laneNumber;

  // 2. Dapatkan pertandingan yang sedang berjalan
  const activeHeat = await db.query.activeHeats.findFirst({
    where: eq(activeHeats.status, "RUNNING"),
  });

  if (!activeHeat) return;

  // 3. Cari data peserta di lintasan tersebut pada heat aktif
  const lane = await db.query.laneAssignments.findFirst({
    where: and(
      eq(laneAssignments.activeHeatId, activeHeat.id),
      eq(laneAssignments.laneNumber, laneNumber),
    ),
  });

  if (!lane) {
    console.warn(
      `⚠️ Node [${node}] (Lintasan ${laneNumber}) terdeteksi, tapi tidak ada atlet di lintasan ini.`,
    );
    return;
  }

  // 4. Kalkulasi Waktu (Logika startOffset tetap dipertahankan)
  const startOffset = activeHeat.hardwareStartMillis ?? 0;
  const cumulativeMillis = elapsed - startOffset;
  let splitTimeMillis = cumulativeMillis;

  if (lap_order > 1) {
    const prevLap = await db.query.lapTimes.findFirst({
      where: and(
        eq(lapTimes.laneAssignmentId, lane.id),
        eq(lapTimes.lapNumber, lap_order - 1),
      ),
      orderBy: [desc(lapTimes.lapNumber)],
    });

    if (prevLap) {
      splitTimeMillis = elapsed - prevLap.rawMillis;
    }
  }

  // 5. Simpan ke Database
  await db.insert(lapTimes).values({
    laneAssignmentId: lane.id,
    lapNumber: lap_order,
    splitTime: formatTime(splitTimeMillis),
    cumulativeTime: formatTime(cumulativeMillis),
    rawMillis: elapsed,
  });

  console.log(
    `🏊 Node: ${node} -> Lintasan ${laneNumber} | Lap ${lap_order} | Total: ${formatTime(cumulativeMillis)}`,
  );
}

// ==========================================
// UTILITY
// ==========================================

function formatTime(ms: number): string {
  // Jika karena alasan tertentu angkanya negatif (misal startOffset lebih besar dari elapsed akibat error hardware)
  if (ms < 0) ms = 0;

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  const m = minutes.toString().padStart(2, "0");
  const s = seconds.toString().padStart(2, "0");
  const msStr = (milliseconds / 10).toFixed(0).padStart(2, "0"); // Ambil 2 digit ms

  return `${m}:${s}.${msStr}`;
}
