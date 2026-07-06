import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Loads the repo-root .env for standalone db scripts (migrate/seed) regardless
 * of the current working directory. Import this FIRST, before ./client, so the
 * env is populated before the client module evaluates.
 */
const here = dirname(fileURLToPath(import.meta.url)); // packages/db/src
config({ path: resolve(here, "../../../.env") });
