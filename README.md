# Arena — Games of Chance

A self-hosted platform where players register, join games decided purely by chance,
and each round becomes a video posted to Instagram / YouTube Shorts / TikTok.

**Phase 1 (this repo): the website + database.** The video-generation job is a later phase.

## Stack

| Layer | Choice |
|-------|--------|
| Monorepo | pnpm workspaces + Turborepo |
| Web | Vite + React + React Router + TanStack Query + Tailwind (`apps/web`) |
| API | Hono + Better Auth (`apps/api`) |
| Auth | **Passwordless** — email one-time code (OTP) + Google OAuth. No passwords. |
| DB | Postgres 15 + Drizzle ORM (`packages/db`) |
| Storage | MinIO (S3-compatible) — `profile-pics`, `videos`, `calculated-rounds` buckets |
| Shared | Enums / Zod schemas / types (`packages/core`) |

## Quick start (local dev)

```bash
# 1. Install
pnpm install

# 2. Env — copy and (optionally) fill Google creds
cp .env.example .env          # a dev BETTER_AUTH_SECRET is fine locally

# 3. Start infra (Postgres + MinIO + Mailpit)
pnpm dev:infra

# 4. Create schema + seed sample games
pnpm db:migrate
pnpm db:seed

# 5. Run API + web
pnpm dev
```

- Web:      http://localhost:5173
- API:      http://localhost:3000
- Mailpit:  http://localhost:8025  ← **read your login OTP codes here**
- MinIO console: http://localhost:9001 (minioadmin / minioadmin)

### Logging in
Enter your email → open Mailpit → copy the 6-digit code → paste it. First login
creates your account. "Continue with Google" works once `GOOGLE_CLIENT_ID/SECRET`
are set in `.env` (redirect URI: `http://localhost:3000/api/auth/callback/google`).

## Useful scripts

```bash
pnpm dev            # turbo: run web + api
pnpm db:studio      # Drizzle Studio (browse the DB)
pnpm db:generate    # generate a migration after schema changes
pnpm -r check-types # type-check every package
pnpm dev:infra:down # stop docker services
```

## Layout

```
apps/
  web/            React SPA
  api/            Hono API + Better Auth
  # generator/    (later) video-generation job — will reuse packages/db
packages/
  core/           enums, zod schemas, shared types
  db/             Drizzle schema, migrations, client, seed
infrastructure/   k8s manifests (postgres today; +minio/api/web later)
docker-compose.dev.yml
```

## Not yet built (next phases)
- Video-generation job (`apps/generator`): round calc → render → approve → post.
- k3s manifests for api/web + MinIO + ingress/TLS. `infrastructure/postgres.yaml`
  still needs a `Service` and a `postgres-credentials` secret to be reachable in-cluster.
