import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  boolean,
  unique,
} from "drizzle-orm/pg-core";

export const nodeAssignments = pgTable("node_assignments", {
  id: serial("id").primaryKey(),
  nodeId: varchar("node_id").notNull().unique(),
  laneNumber: integer("lane_number").notNull(),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activeHeats = pgTable("active_heats", {
  id: serial("id").primaryKey(),
  serverHeatId: varchar("server_heat_id").notNull(),
  eventTitle: varchar("event_title"),
  status: varchar("status", {
    enum: ["PENDING", "RUNNING", "FINISHED", "SYNCED"],
  }).default("PENDING"),
  startedAt: timestamp("started_at"),
  hardwareStartMillis: integer("hardware_start_millis"),
});

export const laneAssignments = pgTable("lane_assignments", {
  id: serial("id").primaryKey(),
  activeHeatId: integer("active_heat_id").references(() => activeHeats.id, {
    onDelete: "cascade",
  }),
  serverParticipantId: varchar("server_participant_id").notNull(),
  laneNumber: integer("lane_number").notNull(),
  athleteName: varchar("athlete_name"),
  clubName: varchar("club_name"),
  finalTime: varchar("final_time"),
  status: varchar("status", { enum: ["OK", "DNS", "DNF", "DSQ"] }).default(
    "OK",
  ),
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
