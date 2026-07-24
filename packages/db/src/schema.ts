import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  boolean,
  bigint,
} from "drizzle-orm/pg-core";

// 1. EVENTS (Ditambah field dari Excel)
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  serverEventId: integer("server_event_id").unique(), // Boleh null jika dibuat lokal (belum sync)

  // Data dari Excel
  eventName: varchar("event_name").notNull(),       // cth: "ACARA 101"
  ageGroup: varchar("age_group"),                   // cth: "(KU 4)"
  distanceStyle: varchar("distance_style"),         // cth: "200m Gaya Bebas"
  gender: varchar("gender"),                        // cth: "PUTRA"
});

// 2. HEATS (Dipertahankan, sangat solid)
export const heats = pgTable("heats", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  serverHeatId: integer("server_heat_id").unique(),
  label: integer("label").notNull(), // cth: 1 (untuk Seri 1)

  status: varchar("status", {
    enum: ["PENDING", "RUNNING", "FINISHED", "STOPPED"],
  }).default("PENDING"),

  isCurrent: boolean("is_current").default(false).notNull(),
  isSynced: boolean("is_synced").default(false),
  maxLaps: integer("max_laps").default(1).notNull(),

  startedAt: timestamp("started_at"),
  hardwareStartMillis: bigint("hardware_start_millis", { mode: "number" }),
});

// 3. LANE ASSIGNMENTS (Diperkaya untuk Excel & Penjurian)
export const laneAssignments = pgTable("lane_assignments", {
  id: serial("id").primaryKey(),
  heatId: integer("heat_id")
    .notNull()
    .references(() => heats.id, { onDelete: "cascade" }),
  serverParticipantId: integer("server_participant_id"),

  laneNumber: integer("lane_number").notNull(),

  // Data dari Excel
  athleteName: varchar("athlete_name"),
  birthYear: varchar("birth_year"), // Kolom: Thn Lahir
  ageGroup: varchar("age_group"),   // Kolom: KU
  clubName: varchar("club_name"),   // Kolom: Asal Sekolah/Klub
  seedTime: varchar("seed_time"), // Untuk kolom QET di Excel (cth: "02:58.94" atau "NT")

  // Hasil Lomba
  finalTimeMillis: bigint("final_time_millis", { mode: "number" }),
  finalTime: varchar("final_time"),

  // Status opsional untuk penjurian (Diskualifikasi / Tidak Hadir)
  status: varchar("status", {
    enum: ["OK", "DNS", "DSQ", "DNF"], // DNS: Did Not Start, DSQ: Disqualified
  }).default("OK"),
});

// 4. LAP TIMES (Tetap dipertahankan)
export const lapTimes = pgTable("lap_times", {
  id: serial("id").primaryKey(),
  laneAssignmentId: integer("lane_assignment_id")
    .notNull()
    .references(() => laneAssignments.id, { onDelete: "cascade" }),

  lapNumber: integer("lap_number").notNull(),
  splitTime: varchar("split_time").notNull(),
  cumulativeTime: varchar("cumulative_time").notNull(),
  rawMillis: bigint("raw_millis", { mode: "number" }).notNull(),

  recordedAt: timestamp("recorded_at").defaultNow(),
});
