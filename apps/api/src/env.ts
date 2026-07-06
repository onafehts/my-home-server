import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * Loads and validates environment. Imported FIRST (see index.ts) so DATABASE_URL
 * is populated before @arena/db's client module evaluates.
 */
const here = dirname(fileURLToPath(import.meta.url)); // apps/api/src
config({ path: resolve(here, "../../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  API_PORT: z.coerce.number().default(3000),
  WEB_URL: z.string().url().default("http://localhost:5173"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().default("Arena <no-reply@arena.local>"),
  MINIO_ENDPOINT: z.string().default("localhost"),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.string().default("false"),
  MINIO_ACCESS_KEY: z.string().default("minioadmin"),
  MINIO_SECRET_KEY: z.string().default("minioadmin"),
  MINIO_BUCKET_AVATARS: z.string().default("profile-pics"),
  MINIO_PUBLIC_URL: z.string().url().default("http://localhost:9000"),
});

export const env = envSchema.parse(process.env);
export const googleEnabled = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);
