/**
 * Hono context variables. Defined in its own module (not app.ts) so route files
 * can import the type without creating an import cycle with the app wiring.
 */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type Variables = {
  user: SessionUser | null;
};
