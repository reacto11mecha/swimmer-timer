import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const nodeAssignments = pgTable("node_assignments", {
  id: serial("id").primaryKey(),
  nodeId: varchar("node_id").notNull().unique(),
  laneNumber: integer("lane_number").notNull(),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  serverEventId: integer("server_event_id").notNull().unique(),
  kodeAcara: integer("kode_acara").notNull(),
  nomorLomba: integer("nomor_lomba").notNull(),
});

export const heats = pgTable("heats", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, {
    onDelete: "cascade",
  }),
  serverHeatId: integer("server_heat_id").notNull().unique(),
  label: integer("label").notNull(),

  status: varchar("status", {
    enum: ["PENDING", "RUNNING", "FINISHED"],
  }).default("PENDING"),

  isSynced: boolean("is_synced").default(false),

  maxLaps: integer("max_laps").default(1).notNull(),
  startedAt: timestamp("started_at"),
  hardwareStartMillis: integer("hardware_start_millis"),
});

export const laneAssignments = pgTable("lane_assignments", {
  id: serial("id").primaryKey(),
  heatId: integer("heat_id").references(() => heats.id, {
    onDelete: "cascade",
  }),
  serverParticipantId: integer("server_participant_id").notNull(),
  laneNumber: integer("lane_number").notNull(),
  athleteName: varchar("athlete_name"),
  clubName: varchar("club_name"),

  // (angka kalkulasi finish - starter)
  finalTimeMillis: integer("final_time_millis"),

  // untuk keperluan interface (cnt: "01:23.45")
  finalTime: varchar("final_time"),
});

export const lapTimes = pgTable("lap_times", {
  id: serial("id").primaryKey(),
  laneAssignmentId: integer("lane_assignment_id").references(
    () => laneAssignments.id,
    { onDelete: "cascade" },
  ),
  lapNumber: integer("lap_number").notNull(),
  splitTime: varchar("split_time").notNull(),
  cumulativeTime: varchar("cumulative_time").notNull(),
  rawMillis: integer("raw_millis").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow(),
});
