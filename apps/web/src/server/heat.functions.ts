import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { events, heats, laneAssignments } from "@swimmer-timer/db/schema";
import { publishResetToHardware } from "./mqtt.functions";

// URL Server Registrasi
const REGISTRATION_API_URL =
  process.env.REGISTRATION_API_URL || "https://api-registrasi.com";

const DUMMY_DATA = [
  {
    id: 1,
    kode_acara: 101,
    nomor_lomba: 50,
    heats: [
      {
        id: 1001,
        label: 1,
        lanes: [
          {
            lane: 1,
            participantId: 5001,
            name: "Budi Santoso",
            club: "Tirta Jaya",
          },
          {
            lane: 2,
            participantId: 5002,
            name: "Agus Pratama",
            club: "Millenium",
          },
          {
            lane: 3,
            participantId: 5003,
            name: "Rizky Firmansyah",
            club: "Lumba Lumba",
          },
          {
            lane: 4,
            participantId: 5004,
            name: "Kevin Wijaya",
            club: "Aquarius",
          },
        ],
      },
      {
        id: 1002,
        label: 2,
        lanes: [
          {
            lane: 1,
            participantId: 5005,
            name: "Andi Saputra",
            club: "Tirta Jaya",
          },
          {
            lane: 2,
            participantId: 5006,
            name: "Dika Maulana",
            club: "Lumba Lumba",
          },
          {
            lane: 3,
            participantId: 5007,
            name: "Evan Dimas",
            club: "Millenium",
          },
          {
            lane: 4,
            participantId: 5008,
            name: "Fajar Nugraha",
            club: "Aquarius",
          },
        ],
      },
      {
        id: 1003,
        label: 3,
        lanes: [
          {
            lane: 2,
            participantId: 5009,
            name: "Gilang Ramadhan",
            club: "Tirta Jaya",
          },
          {
            lane: 3,
            participantId: 5010,
            name: "Hendra Setiawan",
            club: "Lumba Lumba",
          },
        ],
      },
    ],
  },
  {
    id: 2,
    kode_acara: 102,
    nomor_lomba: 100,
    heats: [
      {
        id: 2001,
        label: 1,
        lanes: [
          {
            lane: 1,
            participantId: 6001,
            name: "Irfan Hakim",
            club: "Pari Sakti",
          },
          {
            lane: 2,
            participantId: 6002,
            name: "Joko Widodo",
            club: "Bina Taruna",
          },
          {
            lane: 3,
            participantId: 6003,
            name: "Kiki Amalia",
            club: "Pari Sakti",
          },
          {
            lane: 4,
            participantId: 6004,
            name: "Lina Marlina",
            club: "Bina Taruna",
          },
        ],
      },
      {
        id: 2002,
        label: 2,
        lanes: [
          {
            lane: 1,
            participantId: 6005,
            name: "Maman Abdurahman",
            club: "Pari Sakti",
          },
          {
            lane: 2,
            participantId: 6006,
            name: "Nia Ramadhani",
            club: "Bina Taruna",
          },
          {
            lane: 3,
            participantId: 6007,
            name: "Oki Setiana Dewi",
            club: "Pari Sakti",
          },
          {
            lane: 4,
            participantId: 6008,
            name: "Putri Titian",
            club: "Bina Taruna",
          },
        ],
      },
      {
        id: 2003,
        label: 3,
        lanes: [
          {
            lane: 1,
            participantId: 6009,
            name: "Qory Sandioriva",
            club: "Pari Sakti",
          },
          {
            lane: 2,
            participantId: 6010,
            name: "Raffi Ahmad",
            club: "Bina Taruna",
          },
          { lane: 3, participantId: 6011, name: "Sule", club: "Pari Sakti" },
          {
            lane: 4,
            participantId: 6012,
            name: "Tukul Arwana",
            club: "Bina Taruna",
          },
        ],
      },
      {
        id: 2004,
        label: 4,
        lanes: [
          { lane: 2, participantId: 6013, name: "Uus", club: "Pari Sakti" },
          {
            lane: 3,
            participantId: 6014,
            name: "Vicky Prasetyo",
            club: "Bina Taruna",
          },
        ],
      },
    ],
  },
  {
    id: 3,
    kode_acara: 201,
    nomor_lomba: 200,
    heats: [
      {
        id: 3001,
        label: 1,
        lanes: [
          {
            lane: 1,
            participantId: 7001,
            name: "Wendi Cagur",
            club: "Bintang Laut",
          },
          {
            lane: 2,
            participantId: 7002,
            name: "Xavier",
            club: "Bintang Laut",
          },
          {
            lane: 3,
            participantId: 7003,
            name: "Yanto Basna",
            club: "Mutiara",
          },
          {
            lane: 4,
            participantId: 7004,
            name: "Zulham Zamrun",
            club: "Mutiara",
          },
        ],
      },
      {
        id: 3002,
        label: 2,
        lanes: [
          {
            lane: 1,
            participantId: 7005,
            name: "Ahmad Bustomi",
            club: "Bintang Laut",
          },
          { lane: 2, participantId: 7006, name: "Bima Sakti", club: "Mutiara" },
          {
            lane: 3,
            participantId: 7007,
            name: "Cristian Gonzales",
            club: "Bintang Laut",
          },
          {
            lane: 4,
            participantId: 7008,
            name: "Diego Michiels",
            club: "Mutiara",
          },
        ],
      },
      {
        id: 3003,
        label: 3,
        lanes: [
          {
            lane: 1,
            participantId: 7009,
            name: "Egy Maulana Vikri",
            club: "Bintang Laut",
          },
          { lane: 2, participantId: 7010, name: "Evan Dimas", club: "Mutiara" },
        ],
      },
    ],
  },
  {
    id: 4,
    kode_acara: 301,
    nomor_lomba: 400,
    heats: [
      {
        id: 4001,
        label: 1,
        lanes: [
          {
            lane: 1,
            participantId: 8001,
            name: "Fachrudin Aryanto",
            club: "Cendrawasih",
          },
          {
            lane: 2,
            participantId: 8002,
            name: "Greg Nwokolo",
            club: "Cendrawasih",
          },
          {
            lane: 3,
            participantId: 8003,
            name: "Hansamu Yama",
            club: "Hiu Putih",
          },
          {
            lane: 4,
            participantId: 8004,
            name: "Ilija Spasojevic",
            club: "Hiu Putih",
          },
        ],
      },
      {
        id: 4002,
        label: 2,
        lanes: [
          {
            lane: 1,
            participantId: 8005,
            name: "Jajang Mulyana",
            club: "Cendrawasih",
          },
          {
            lane: 2,
            participantId: 8006,
            name: "Kurnia Meiga",
            club: "Hiu Putih",
          },
          {
            lane: 3,
            participantId: 8007,
            name: "Lerby Eliandry",
            club: "Cendrawasih",
          },
          {
            lane: 4,
            participantId: 8008,
            name: "Marc Klok",
            club: "Hiu Putih",
          },
        ],
      },
      {
        id: 4003,
        label: 3,
        lanes: [
          {
            lane: 1,
            participantId: 8009,
            name: "Nadeo Argawinata",
            club: "Cendrawasih",
          },
          {
            lane: 2,
            participantId: 8010,
            name: "Osvaldo Haay",
            club: "Hiu Putih",
          },
          {
            lane: 3,
            participantId: 8011,
            name: "Pratama Arhan",
            club: "Cendrawasih",
          },
          {
            lane: 4,
            participantId: 8012,
            name: "Ricky Kambuaya",
            club: "Hiu Putih",
          },
        ],
      },
      {
        id: 4004,
        label: 4,
        lanes: [
          {
            lane: 2,
            participantId: 8013,
            name: "Saddil Ramdani",
            club: "Cendrawasih",
          },
          {
            lane: 3,
            participantId: 8014,
            name: "Stefano Lilipaly",
            club: "Hiu Putih",
          },
        ],
      },
    ],
  },
  {
    id: 5,
    kode_acara: 401,
    nomor_lomba: 800,
    heats: [
      {
        id: 5001,
        label: 1,
        lanes: [
          {
            lane: 1,
            participantId: 9001,
            name: "Terens Puhiri",
            club: "Pesut Mahakam",
          },
          {
            lane: 2,
            participantId: 9002,
            name: "Victor Igbonefo",
            club: "Pesut Mahakam",
          },
          {
            lane: 3,
            participantId: 9003,
            name: "Wawan Hendrawan",
            club: "Macan Kemayoran",
          },
          {
            lane: 4,
            participantId: 9004,
            name: "Yanto Basna",
            club: "Macan Kemayoran",
          },
        ],
      },
      {
        id: 5002,
        label: 2,
        lanes: [
          {
            lane: 1,
            participantId: 9005,
            name: "Zalnando",
            club: "Pesut Mahakam",
          },
          {
            lane: 2,
            participantId: 9006,
            name: "Abduh Lestaluhu",
            club: "Macan Kemayoran",
          },
          {
            lane: 3,
            participantId: 9007,
            name: "Bagus Kahfi",
            club: "Pesut Mahakam",
          },
          {
            lane: 4,
            participantId: 9008,
            name: "Bagas Kaffa",
            club: "Macan Kemayoran",
          },
        ],
      },
      {
        id: 5003,
        label: 3,
        lanes: [
          {
            lane: 2,
            participantId: 9009,
            name: "David da Silva",
            club: "Pesut Mahakam",
          },
          {
            lane: 3,
            participantId: 9010,
            name: "Ezra Walian",
            club: "Macan Kemayoran",
          },
        ],
      },
    ],
  },
  {
    id: 6,
    kode_acara: 501,
    nomor_lomba: 1500,
    heats: [
      {
        id: 6001,
        label: 1,
        lanes: [
          {
            lane: 1,
            participantId: 10001,
            name: "Febri Hariyadi",
            club: "Maung Bandung",
          },
          {
            lane: 2,
            participantId: 10002,
            name: "Gian Zola",
            club: "Singo Edan",
          },
          {
            lane: 3,
            participantId: 10003,
            name: "Hanif Sjahbandi",
            club: "Maung Bandung",
          },
          {
            lane: 4,
            participantId: 10004,
            name: "Irfan Bachdim",
            club: "Singo Edan",
          },
        ],
      },
      {
        id: 6002,
        label: 2,
        lanes: [
          {
            lane: 2,
            participantId: 10005,
            name: "Jefri Kurniawan",
            club: "Maung Bandung",
          },
          {
            lane: 3,
            participantId: 10006,
            name: "Kim Jeffrey Kurniawan",
            club: "Singo Edan",
          },
        ],
      },
      {
        id: 6003,
        label: 3,
        lanes: [
          {
            lane: 2,
            participantId: 10007,
            name: "Makan Konate",
            club: "Maung Bandung",
          },
        ],
      },
    ],
  },
];

// 1. Fungsi untuk Sinkronisasi Data Pagi Hari (Fetch Semua Acara & Heat)
export const syncDailySchedule = createServerFn({ method: "POST" }).handler(
  async () => {
    // // Ambil data seluruh acara hari ini dari Server Registrasi
    // const response = await fetch(`${REGISTRATION_API_URL}/api/schedule/today`);

    // if (!response.ok) {
    //   throw new Error("Gagal mengambil data jadwal dari server registrasi.");
    // }

    const externalData = DUMMY_DATA;

    // Menggunakan transaction agar aman (rollback jika gagal di tengah-tengah)
    await db.transaction(async (tx) => {
      for (const event of externalData) {
        // Insert atau Update Event
        const [newDbEvent] = await tx
          .insert(events)
          .values({
            serverEventId: event.id,
            kodeAcara: event.kode_acara,
            nomorLomba: event.nomor_lomba,
          })
          .onConflictDoUpdate({
            target: events.serverEventId,
            set: {
              kodeAcara: event.kode_acara,
              nomorLomba: event.nomor_lomba,
            },
          })
          .returning({ id: events.id });

        for (const heat of event.heats) {
          // Insert atau Update Heat
          const [newDbHeat] = await tx
            .insert(heats)
            .values({
              eventId: newDbEvent.id,
              serverHeatId: heat.id,
              label: heat.label,
              status: "PENDING",
              isSynced: false,
            })
            .onConflictDoUpdate({
              target: heats.serverHeatId,
              set: {
                label: heat.label,
                eventId: newDbEvent.id,
              },
            })
            .returning({ id: heats.id });

          // Bersihkan data lane lama untuk heat ini agar sinkron secara presisi
          await tx
            .delete(laneAssignments)
            .where(eq(laneAssignments.heatId, newDbHeat.id));

          // Mapping dan Insert Lanes
          const laneData = heat.lanes.map((l: any) => ({
            heatId: newDbHeat.id,
            serverParticipantId: l.participantId,
            laneNumber: l.lane,
            athleteName: l.name,
            clubName: l.club,
            status: "OK",
          }));

          if (laneData.length > 0) {
            await tx.insert(laneAssignments).values(laneData);
          }
        }
      }
    });

    return { success: true, message: "Sinkronisasi pagi berhasil." };
  },
);

// 2. Fungsi untuk Mengaktifkan Heat Spesifik saat lomba berjalan
export const activateHeat = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      heatDbId: z.number().min(1, "ID Heat (Local DB) harus diisi"),
    }),
  )
  .handler(async ({ data }) => {
    // Set heat yang dipilih menjadi RUNNING
    await db.transaction(async (tx) => {
      await tx
        .update(heats)
        .set({ status: "PENDING" })
        .where(eq(heats.status, "RUNNING"));

      await tx
        .update(heats)
        .set({ status: "RUNNING" })
        .where(eq(heats.id, data.heatDbId));
    });

    // Reset Hardware via MQTT saat heat baru diaktifkan
    await publishResetToHardware();

    return { success: true };
  });

// 3. Fungsi untuk mengambil Heat yang sedang RUNNING beserta data Acara (Event)
export const getRunningHeat = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await db
      .select({
        id: heats.id,
        label: heats.label,
        maxLaps: heats.maxLaps,
        status: heats.status,
        event: {
          kodeAcara: events.kodeAcara,
          nomorLomba: events.nomorLomba,
        },
      })
      .from(heats)
      .innerJoin(events, eq(heats.eventId, events.id))
      .where(eq(heats.status, "RUNNING"))
      .limit(1);

    return result[0] || null;
  },
);

// 4. Fungsi untuk mengambil semua Heat yang berstatus PENDING beserta data Acara (Event)
export const getPendingHeats = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await db
      .select({
        id: heats.id,
        label: heats.label,
        maxLaps: heats.maxLaps,
        status: heats.status,
        event: {
          kodeAcara: events.kodeAcara,
          nomorLomba: events.nomorLomba,
        },
      })
      .from(heats)
      .innerJoin(events, eq(heats.eventId, events.id))
      .where(eq(heats.status, "PENDING"));

    return result;
  },
);

// 5. Fungsi untuk memperbarui jumlah Batas Maksimal Lap pada Heat tertentu
export const updateHeatMaxLaps = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      heatId: z.number(),
      maxLaps: z.number().min(1, "Minimal harus 1 lap"),
    }),
  )
  .handler(async ({ data }) => {
    await db
      .update(heats)
      .set({ maxLaps: data.maxLaps })
      .where(eq(heats.id, data.heatId));

    return { success: true };
  });
