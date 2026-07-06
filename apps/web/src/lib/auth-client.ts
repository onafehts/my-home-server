import {
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * Better Auth browser client. baseURL is the API origin; the client targets
 * /api/auth by default. `credentials: include` so the session cookie flows.
 *
 * inferAdditionalFields teaches the client about our custom user fields
 * (firstName/lastName) so updateUser() is typed and keeps the session in sync.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: "include" },
  plugins: [
    emailOTPClient(),
    inferAdditionalFields({
      user: {
        firstName: { type: "string" },
        lastName: { type: "string" },
      },
    }),
  ],
});

export const { useSession, signOut, signIn } = authClient;
