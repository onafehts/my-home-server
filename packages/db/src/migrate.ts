import "./load-env";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const here = dirname(fileURLToPath(import.meta.url)); // packages/db/src
const migrationsFolder = resolve(here, "../drizzle");

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

console.log("Running migrations from", migrationsFolder);
await migrate(db, { migrationsFolder });
console.log("Migrations complete.");
await sql.end();
