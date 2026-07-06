import type { Context, Next } from "hono";
import { auth } from "../auth";
import type { SessionUser, Variables } from "../types";

/**
 * Resolves the Better Auth session from cookies and stashes the user on the
 * context. Runs for our own routes (not the /api/auth/* handler).
 */
export async function withSession(
  c: Context<{ Variables: Variables }>,
  next: Next,
): Promise<void> {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", (result?.user ?? null) as SessionUser | null);
  await next();
}

/** Rejects the request with 401 when there is no authenticated user. */
export async function requireAuth(
  c: Context<{ Variables: Variables }>,
  next: Next,
): Promise<Response | void> {
  if (!c.get("user")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}
