import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@swimmer-timer/db/schema";

export const db = drizzle(process.env.DATABASE_URL!, { schema });
