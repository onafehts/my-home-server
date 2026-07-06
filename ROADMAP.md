# Arena — Roadmap & Status Map

Legend: ✅ **Done** (real, working) · 🟡 **Mocked** (works end-to-end with a
stand-in; needs an external system to be real) · ⬜ **Pending** (not built).

This file is the source of truth for what is real vs. simulated. Every 🟡 lists
exactly what makes it real.

---

## 1. Foundation & platform

| Feature | Status | Notes / what's left |
|---|---|---|
| pnpm + Turborepo monorepo | ✅ | `apps/web`, `apps/api`, `packages/{core,db}` |
| Postgres 15 + Drizzle schema (24 tables) | ✅ | migrations in `packages/db/drizzle` |
| Local dev infra (Postgres/MinIO/Mailpit) | ✅ | `docker-compose.dev.yml` |
| Shared enums/schemas/scoring | ✅ | `packages/core` |
| Type-checking across workspace | ✅ | `pnpm -r check-types` clean |

## 2. Auth

| Feature | Status | Notes / what's left |
|---|---|---|
| Email one-time-code (OTP) login | ✅ | Better Auth; codes delivered via SMTP |
| OTP email delivery | 🟡 | Local uses **Mailpit**. Real: point SMTP env at a transactional provider (Postmark/SES/Resend). |
| Google social login | 🟡 | Wired; inactive until real `GOOGLE_CLIENT_ID/SECRET` set. |
| Instagram/TikTok/YouTube login | ⬜ | Intentionally not login providers (restricted OAuth). Handles are profile data instead. |
| Sessions in Postgres | ✅ | |

## 3. Games, rounds & the engine

| Feature | Status | Notes / what's left |
|---|---|---|
| Games catalog + join/leave | ✅ | |
| Enter next round (site) | ✅ | `POST /games/:id/enter` |
| **Round results / placements / points** | 🟡 | Produced by the **mock round engine** (`packages/db/src/engine.ts`): seeded shuffle → placements → points → ledger → ranking snapshots → notifications → achievements. |
| Provably-fair seed | 🟡 | Seed is stored & reproducible, but the "physics" is a shuffle, not a real sim. |
| **Video generation + rendering** | ⬜ | **The big one.** Real engine: gather entrants → physics sim → render MP4 → per-player highlight clips. Replaces the mock engine's shuffle; everything downstream already consumes its DB output. |
| Per-player highlight clips | 🟡 | `round_participants.highlightClipUrl` holds a `mock://` URL. Real: emitted by the video job to the `videos` bucket. |
| Simulate-round trigger | 🟡 | `POST /admin/simulate-round` (any authed user). Real: internal/role-gated, or driven by the job on a schedule. |

## 4. Rankings

| Feature | Status | Notes |
|---|---|---|
| Points ledger (auditable) | ✅ | `points_ledger`; rankings are aggregates |
| Per-game leaderboard (all-time + season) | ✅ | snapshot per round |
| Global cross-game leaderboard | ✅ | `GET /leaderboards?scope=` |
| "Your rank" + percentile | ✅ | `GET /me/rank` |
| Seasons (monthly) | ✅ | one active season; seeded for current month |
| Season rollover / reset job | ⬜ | Needs a cron to close a season, snapshot finals, open the next, notify. |
| Divisions (Bronze→Legend) | ✅ | derived from season points |
| Promotion/relegation events | ⬜ | Division is derived live; no promote/relegate notifications or history yet. |

## 5. Player profile & engagement

| Feature | Status | Notes |
|---|---|---|
| Profile (name, avatar, socials) | ✅ | avatar → MinIO |
| Stats (rounds/wins/podiums/best/points) | ✅ | `GET /me/stats` |
| **Find your result** (history + share card) | ✅ | `GET /me/results`; SVG card is real |
| Shareable result card (SVG) | ✅ | `GET /cards/round/:r/user/:u` |
| Achievements | 🟡 | `first_round`/`first_win`/`podium` awarded by the engine. `survivor`/`veteran` are defined but **not yet awarded** (need rule hooks). |
| Notifications (in-app) | ✅ | round result / eliminated / achievement |
| Push / email notifications | ⬜ | In-app only. Real: web-push or email on key events. |

## 6. Monetization

| Feature | Status | Notes / what's left |
|---|---|---|
| Club (premium) tier | 🟡 | Subscribe/cancel toggles the tier in DB. **No billing.** Real: Stripe checkout + webhooks → set `subscriptions`. |
| Club perks enforcement | 🟡 | Club-only cosmetics are gated; "guaranteed entry / exclusive games" are **not enforced** yet. |
| Cosmetics (skins/trails/name colors) | 🟡 | Equip works and gates club-only items, but acquisition is **mock** (granted on equip, no purchase). Real: purchase flow + inventory; and the **video job must actually render** the equipped skin. |
| Merch | ⬜ | Not built (competitor sells hats). |

## 7. Instagram / distribution

| Feature | Status | Notes / what's left |
|---|---|---|
| Post image previews (announcement/winner/leaderboard) | 🟡 | Real SVGs at `/ig/...`, shown in **Studio**. Real: render to PNG/MP4 and **post via Instagram Graph API** (+ TikTok/YouTube APIs). |
| Comment-to-enter ingestion | 🟡 | `POST /ig/ingest-comments` fabricates `instagram_comment` entries. Real: Instagram Graph API webhook on comments → match handle → create entry. |
| Follow-to-enter ingestion | ⬜ | No follower-webhook ingestion yet. |
| Auto-posting rounds to channels | ⬜ | Needs the video job + Graph API publish + the `content` table wired to real permalinks. |
| Link-in-bio → site signup funnel | ✅ | Site handles signup; just needs the bio link in production. |

## 8. Infrastructure & deploy

| Feature | Status | Notes / what's left |
|---|---|---|
| Local dev (docker-compose) | ✅ | |
| Postgres in k3s | 🟡 | `infrastructure/postgres.yaml` exists but **needs a `Service`** + `postgres-credentials` secret to be reachable in-cluster. |
| MinIO in k3s | ⬜ | Only local (docker-compose) today. |
| API/Web k8s manifests | ⬜ | Not written. Need Deployments/Services/Ingress + TLS. |
| Video-job service (`apps/generator`) | ⬜ | Placeholder in the plan; not scaffolded. Will reuse `packages/db`. |
| CI / migrations-on-deploy | ⬜ | |

---

## Suggested next milestones (in order)

1. **Real video engine** (`apps/generator`) — swap the mock `simulateRound` shuffle
   for a physics sim + render, writing to the `videos` bucket. Everything downstream
   (results, rankings, highlights, cards) already consumes its output.
2. **Instagram Graph API** — auto-post rounds + ingest real comment/follow entries.
3. **Stripe billing** for Club; enforce guaranteed-entry / exclusive-games perks.
4. **Season rollover cron** + promotion/relegation events & notifications.
5. **k3s deploy** — Services/secrets for Postgres + MinIO, manifests for api/web, ingress/TLS.
6. Push/email notifications; remaining achievement rules (`survivor`, `veteran`).
