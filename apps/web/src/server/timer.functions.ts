import { createServerFn } from "@tanstack/react-start";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  events,
  heats,
  laneAssignments,
  lapTimes,
} from "@swimmer-timer/db/schema"; //

export const getLiveDashboard = createServerFn({ method: "GET" }).handler(
  async () => {
    // 1. Cari pertandingan yang statusnya CURRENT atau RUNNING
    const heat = await db.query.heats.findFirst({
      where: inArray(heats.status, ["CURRENT", "RUNNING"]),
    });

    if (!heat) return null;

    const event = await db.query.events.findFirst({
      where: eq(events.id, heat.eventId),
    });

    if (!event) return null;

    // 2. Ambil semua lintasan untuk sesi ini
    const lanes = await db.query.laneAssignments.findMany({
      where: eq(laneAssignments.heatId, heat.id),
      orderBy: (lanes, { asc }) => [asc(lanes.laneNumber)],
    });

    // 3. Ambil lap terakhir untuk setiap lintasan (untuk display real-time)
    const lanesWithData = await Promise.all(
      lanes.map(async (lane) => {
        const lastLap = await db.query.lapTimes.findFirst({
          where: eq(lapTimes.laneAssignmentId, lane.id),
          orderBy: [desc(lapTimes.lapNumber)],
        });
        return { ...lane, lastLap };
      }),
    );

    return { event, heat, lanes: lanesWithData };
  },
);
