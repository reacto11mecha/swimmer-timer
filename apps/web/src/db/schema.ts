import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";

// ==========================================
// 1. TABEL SESI LOMBA (Active Heats)
// Menyimpan sesi/seri yang sedang berjalan di kolam renang saat ini.
// ==========================================
export const activeHeats = pgTable("active_heats", {
  id: serial("id").primaryKey(),

  // ID referensi dari server pendaftaran utama untuk keperluan webhook/sinkronisasi
  serverHeatId: varchar("server_heat_id").notNull(),

  // Denormalisasi: Teks judul acara hanya untuk ditampilkan di UI (misal: "Acara 101 - 800m Surface Putra - Seri 1")
  eventTitle: varchar("event_title"),

  status: varchar("status", {
    enum: ["PENDING", "RUNNING", "FINISHED", "SYNCED"],
  }).default("PENDING"),

  // Waktu real-time server (berguna untuk UI/log)
  startedAt: timestamp("started_at"),

  // REVISI MQTT: Menyimpan nilai millis() dari topik `timer/start` ESP32 sebagai titik nol/offset
  hardwareStartMillis: integer("hardware_start_millis"),
});

// ==========================================
// 2. TABEL PENUGASAN LINTASAN (Lane Assignments)
// Menyimpan siapa yang berenang di lintasan berapa pada sesi yang sedang aktif.
// ==========================================
export const laneAssignments = pgTable("lane_assignments", {
  id: serial("id").primaryKey(),
  activeHeatId: integer("active_heat_id").references(() => activeHeats.id, {
    onDelete: "cascade",
  }),

  // ID referensi atlet/start_list dari server utama pendaftaran
  serverParticipantId: varchar("server_participant_id").notNull(),

  // Nomor lintasan di kolam (1-8) yang terhubung dengan "node" ESP32
  laneNumber: integer("lane_number").notNull(),

  // Denormalisasi: Hanya untuk ditampilkan di layar operator / papan skor
  athleteName: varchar("athlete_name"),
  clubName: varchar("club_name"),

  // Hasil akhir perlombaan (string format waktu)
  finalTime: varchar("final_time"),
  status: varchar("status", { enum: ["OK", "DNS", "DNF", "DSQ"] }).default(
    "OK",
  ),
});

// ==========================================
// 3. TABEL CATATAN WAKTU LAP (Lap Times)
// Di-insert secara real-time oleh MQTT Worker setiap menerima topik `timer/lap`
// ==========================================
export const lapTimes = pgTable("lap_times", {
  id: serial("id").primaryKey(),
  laneAssignmentId: integer("lane_assignment_id").references(
    () => laneAssignments.id,
    { onDelete: "cascade" },
  ),

  // Urutan lap (didapat langsung dari payload lap_order ESP32)
  lapNumber: integer("lap_number").notNull(),

  // String waktu format MM:SS.ms khusus untuk mempermudah render di UI
  splitTime: varchar("split_time").notNull(),
  cumulativeTime: varchar("cumulative_time").notNull(),

  // REVISI MQTT: Menyimpan angka milidetik mentah dari payload `elapsed` ESP32.
  // Sangat penting untuk kalkulasi split dan menghindari masalah presisi string.
  rawMillis: integer("raw_millis").notNull(),

  // Waktu server saat data diterima
  recordedAt: timestamp("recorded_at").defaultNow(),
});
