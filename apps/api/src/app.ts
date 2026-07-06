import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { env } from "./env";
import { withSession } from "./middleware/auth";
import adminRoute from "./routes/admin";
import cardsRoute from "./routes/cards";
import divisionsRoute from "./routes/divisions";
import gamesRoute from "./routes/games";
import igRoute from "./routes/ig";
import leaderboardsRoute from "./routes/leaderboards";
import meRoute from "./routes/me";
import roundsRoute from "./routes/rounds";
import seasonsRoute from "./routes/seasons";
import type { Variables } from "./types";

export const app = new Hono<{ Variables: Variables }>();

// CORS must wrap everything, including the auth handler, and allow credentials
// so the session cookie flows between the web app and the API.
app.use(
  "*",
  cors({
    origin: env.WEB_URL,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

// Better Auth owns everything under /api/auth/* (OTP request/verify, Google, session).
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Everything below gets the resolved session on the context.
app.use("*", withSession);
app.route("/me", meRoute);
app.route("/games", gamesRoute);
app.route("/rounds", roundsRoute);
app.route("/leaderboards", leaderboardsRoute);
app.route("/seasons", seasonsRoute);
app.route("/divisions", divisionsRoute);
app.route("/cards", cardsRoute);
app.route("/ig", igRoute);
app.route("/admin", adminRoute);
