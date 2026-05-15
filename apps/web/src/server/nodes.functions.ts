import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { nodeAssignments } from "@swimmer-timer/db/schema";

// 1. Ambil semua data node (GET adalah default)
export const getNodes = createServerFn({ method: "GET" }).handler(async () => {
  return await db.query.nodeAssignments.findMany({
    orderBy: (nodes, { asc }) => [asc(nodes.laneNumber)],
  });
});

// 2. Tambah node baru (POST)
export const addNode = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      nodeId: z.string().min(1, "Node ID tidak boleh kosong"),
      laneNumber: z.number().min(1).max(8),
    }),
  )
  .handler(async ({ data }) => {
    // Parameter 'data' sudah memiliki tipe statis dari Zod
    await db.insert(nodeAssignments).values({
      nodeId: data.nodeId,
      laneNumber: data.laneNumber,
      isActive: true,
    });
    return { success: true };
  });

// 3. Ubah status aktif/nonaktif (POST)
export const toggleNodeStatus = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.number(),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await db
      .update(nodeAssignments)
      .set({ isActive: data.isActive })
      .where(eq(nodeAssignments.id, data.id));
    return { success: true };
  });

// 4. Hapus node (POST)
export const deleteNode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    await db.delete(nodeAssignments).where(eq(nodeAssignments.id, data.id));
    return { success: true };
  });
