import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Shared Drizzle client. Reads DATABASE_URL from the environment — the consumer
 * (apps/api, scripts) is responsible for loading it. This package does not load
 * .env itself so it never fights the host app's config.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
