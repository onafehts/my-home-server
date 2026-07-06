import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  addSocialSchema,
  avatarUploadRequestSchema,
  updateProfileSchema,
} from "@arena/core";
import { db, user, userSocials } from "@arena/db";
import { requireAuth } from "../middleware/auth";
import { presignedAvatarUpload } from "../storage";
import type { Variables } from "../types";

const me = new Hono<{ Variables: Variables }>();
me.use("*", requireAuth);

/** Current profile + linked social handles. */
me.get("/", async (c) => {
  const current = c.get("user")!;
  const socials = await db
    .select()
    .from(userSocials)
    .where(eq(userSocials.userId, current.id));
  return c.json({ user: current, socials });
});

/** Update first/last name (and derived display name). */
me.patch("/", zValidator("json", updateProfileSchema), async (c) => {
  const current = c.get("user")!;
  const body = c.req.valid("json");
  const first = body.firstName ?? current.firstName ?? "";
  const last = body.lastName ?? current.lastName ?? "";
  const name = [first, last].filter(Boolean).join(" ").trim();
  const [updated] = await db
    .update(user)
    .set({
      ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
      ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
      ...(name ? { name } : {}),
      updatedAt: new Date(),
    })
    .where(eq(user.id, current.id))
    .returning();
  return c.json({ user: updated });
});

/** Step 1 of avatar change: get a presigned PUT URL for MinIO. */
me.post(
  "/avatar-upload-url",
  zValidator("json", avatarUploadRequestSchema),
  async (c) => {
    const current = c.get("user")!;
    const { contentType } = c.req.valid("json");
    const result = await presignedAvatarUpload(current.id, contentType);
    return c.json(result);
  },
);

/** Step 2: persist the public URL after the browser uploads the file. */
me.put(
  "/avatar",
  zValidator("json", z.object({ imageUrl: z.string().url() })),
  async (c) => {
    const current = c.get("user")!;
    const { imageUrl } = c.req.valid("json");
    const [updated] = await db
      .update(user)
      .set({ image: imageUrl, updatedAt: new Date() })
      .where(eq(user.id, current.id))
      .returning();
    return c.json({ user: updated });
  },
);

// ─── Socials ─────────────────────────────────────────────────────────────────
me.get("/socials", async (c) => {
  const current = c.get("user")!;
  const socials = await db
    .select()
    .from(userSocials)
    .where(eq(userSocials.userId, current.id));
  return c.json({ socials });
});

me.post("/socials", zValidator("json", addSocialSchema), async (c) => {
  const current = c.get("user")!;
  const body = c.req.valid("json");
  const [social] = await db
    .insert(userSocials)
    .values({
      userId: current.id,
      platform: body.platform,
      username: body.username,
      url: body.url ?? null,
    })
    .returning();
  return c.json({ social }, 201);
});

me.delete(
  "/socials/:id",
  zValidator("param", z.object({ id: z.string().uuid() })),
  async (c) => {
    const current = c.get("user")!;
    const { id } = c.req.valid("param");
    await db
      .delete(userSocials)
      .where(and(eq(userSocials.id, id), eq(userSocials.userId, current.id)));
    return c.json({ deleted: true });
  },
);

export default me;
