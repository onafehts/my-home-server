import "./env"; // MUST be first: loads .env before @arena/db evaluates
import { serve } from "@hono/node-server";
import { app } from "./app";
import { env } from "./env";

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
  console.log(`  web origin allowed: ${env.WEB_URL}`);
});
