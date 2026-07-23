import mqtt from "mqtt";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import "dotenv/config";

import * as schema from "@swimmer-timer/db/schema";
const { heats, laneAssignments, lapTimes, nodeAssignments } = schema;

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
const db = drizzle(pool, { schema });

// 2. Setup Koneksi MQTT
const MQTT_BROKER = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const client = mqtt.connect(MQTT_BROKER);
client.on("connect", () => {
  console.log("[MQTT] Terhubung ke broker");

  client.subscribe("starter/start");
  client.subscribe("timer/lap");
});

client.on("message", async (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());

    switch (topic) {
      case "starter/start":
        await handleStarterStart(payload);
        break;
      case "timer/lap":
        await handleTimerLap(payload);
        break;
      default:
        // Mengabaikan topik lain (termasuk telemetry jika ter-publish)
        break;
    }
  } catch (err) {
    console.error("[MQTT] Gagal memproses pesan:", err);
  }
});

// ==========================================
// HANDLER: PISTOL START (GUN)
// ==========================================
async function handleStarterStart(payload: { currentTime: number }) {
  // Cari heat yang sedang berstatus CURRENT (siap ditembak)
  const readyHeat = await db.query.heats.findFirst({
    where: eq(heats.status, "CURRENT"),
  });

  if (readyHeat) {
    // Pistol ditembakkan: Ubah ke RUNNING dan simpan waktu mulai hardware
    await db
      .update(heats)
      .set({
        status: "RUNNING",
        startedAt: new Date(),
        hardwareStartMillis: payload.currentTime,
      })
      .where(eq(heats.id, readyHeat.id));

    console.log(
      `[MQTT] Gun Fired! Heat ${readyHeat.id} status berubah dari CURRENT menjadi RUNNING.`,
    );
  } else {
    console.warn(
      "[MQTT] Sinyal pistol diterima, tetapi tidak ada Heat yang berstatus CURRENT.",
    );
  }
}

// ==========================================
// HANDLER: TOUCHPAD / LAPPING LINTASAN
// ==========================================
async function handleTimerLap(payload: {
  node: string;
  currentTime: number;
  lap_order: number;
}) {
  const { node, currentTime, lap_order } = payload;

  // 1. Cari tahu node ini dialokasikan untuk lintasan (lane) ke berapa
  const assignmentNode = await db.query.nodeAssignments.findFirst({
    where: eq(nodeAssignments.nodeId, node),
  });

  if (!assignmentNode || !assignmentNode.isActive) {
    console.warn(
      `[MQTT] Node ${node} tidak terdaftar atau tidak aktif di lintasan mana pun.`,
    );
    return;
  }

  const lane = assignmentNode.laneNumber;

  // 2. Pastikan ada heat yang sedang berjalan
  const runningHeat = await db.query.heats.findFirst({
    where: eq(heats.status, "RUNNING"),
  });

  if (!runningHeat || !runningHeat.hardwareStartMillis) return;

  // 3. Cari data peserta di lintasan tersebut pada heat ini
  const assignment = await db.query.laneAssignments.findFirst({
    where: and(
      eq(laneAssignments.heatId, runningHeat.id),
      eq(laneAssignments.laneNumber, lane),
    ),
  });

  if (!assignment) return;
  if (assignment.finalTimeMillis) return; // Jika sudah finish, abaikan sentuhan ekstra

  // 4. Kalkulasi waktu dan format
  const calcMillis = currentTime - runningHeat.hardwareStartMillis;

  const splitTimeDisplay = formatTime(calcMillis);

  // 5. Simpan catatan lap menggunakan lap_order dari payload perangkat
  await db.insert(lapTimes).values({
    laneAssignmentId: assignment.id,
    lapNumber: lap_order,
    splitTime: splitTimeDisplay,
    cumulativeTime: splitTimeDisplay,
    rawMillis: calcMillis,
  });

  // 6. Cek apakah batas lap sudah tercapai (Finish)
  if (lap_order >= runningHeat.maxLaps) {
    await db
      .update(laneAssignments)
      .set({
        finalTimeMillis: calcMillis,
        finalTime: splitTimeDisplay,
      })
      .where(eq(laneAssignments.id, assignment.id));

    console.log(
      `[MQTT] Lane ${lane} (Node: ${node}) FINISH di ${splitTimeDisplay}`,
    );
  } else {
    console.log(
      `[MQTT] Lane ${lane} (Node: ${node}) Lap ${lap_order} di ${splitTimeDisplay}`,
    );
  }
}
