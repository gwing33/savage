import { createRedirectResponse } from "remix/response/redirect";
import { db } from "../../db.ts";
import { getSessionToken, clearSessionCookie } from "../../auth.ts";

export default {
  actions: {
    // GET /logout — redirect straight to home (no dedicated page).
    index: () => createRedirectResponse("/"),

    action: {
      // POST /logout — delete the session from the DB, clear the cookie.
      handler: async (context: any) => {
        const token = getSessionToken(context.request);
        if (token) {
          await db.deleteSession(token).catch(() => {
            // Best-effort — the cookie is cleared regardless.
          });
        }
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/",
            "Set-Cookie": clearSessionCookie(),
          },
        });
      },
    },
  },
};
