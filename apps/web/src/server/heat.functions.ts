import { createServerFn } from "@tanstack/react-start";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activeHeats, laneAssignments } from "@swimmer-timer/db/schema";
import { publishResetToHardware } from "./mqtt.functions";

// Asumsi URL Server Registrasi Anda (bisa diletakkan di .env)
const REGISTRATION_API_URL =
  process.env.REGISTRATION_API_URL || "https://api-registrasi.com";

export const syncAndPrepareHeat = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      heatId: z.string().min(1, "ID Seri harus diisi"),
    }),
  )
  .handler(async ({ data }) => {
    // 1. Ambil data dari Server Registrasi
    const response = await fetch(
      `${REGISTRATION_API_URL}/api/heats/${data.heatId}`,
    );

    if (!response.ok) {
      throw new Error("Gagal mengambil data dari server registrasi.");
    }

    const externalData = await response.json();
    /* Asumsi struktur JSON dari server registrasi:
       {
         eventTitle: "800m Surface Putra",
         lanes: [
           { lane: 1, participantId: "P001", name: "Alvino", club: "LIV" },
           ...
         ]
       }
    */

    // 2. Bereskan sesi aktif yang lama
    await db
      .update(activeHeats)
      .set({ status: "FINISHED" })
      .where(inArray(activeHeats.status, ["PENDING", "RUNNING"]));

    // 3. Simpan data baru ke database lokal
    const [newHeat] = await db
      .insert(activeHeats)
      .values({
        serverHeatId: data.heatId,
        eventTitle: externalData.eventTitle,
        status: "PENDING",
      })
      .returning({ id: activeHeats.id });

    const laneData = externalData.lanes.map((l: any) => ({
      activeHeatId: newHeat.id,
      laneNumber: l.lane,
      serverParticipantId: l.participantId,
      athleteName: l.name,
      clubName: l.club,
    }));

    await db.insert(laneAssignments).values(laneData);

    // 4. Reset Hardware via MQTT
    await publishResetToHardware();

    return { success: true, eventTitle: externalData.eventTitle };
  });
