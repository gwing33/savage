import { createHtmlResponse } from "remix/response/html";
import { createRedirectResponse } from "remix/response/redirect";
import { renderToString } from "remix/ui/server";
import { db } from "../../../db.ts";
import { makeSessionCookie } from "../../../auth.ts";
import { VerifyPage } from "../../../login.tsx";

export default {
  actions: {
    // GET /login/verify?email=... — render the code entry form.
    index: async (context: any) => {
      const email = (context.url.searchParams.get("email") ?? "")
        .trim()
        .toLowerCase();

      if (!email) return createRedirectResponse("/login");

      const html = await renderToString(<VerifyPage email={email} />);
      return createHtmlResponse(html);
    },

    action: {
      // POST /login/verify — check the code, create a session, set the cookie.
      handler: async (context: any) => {
        const fd = await context.request.formData();
        const email = (fd.get("email") ?? "").toString().trim().toLowerCase();
        const code = (fd.get("code") ?? "").toString().trim();

        if (!email || !code) {
          const dest = email
            ? `/login/verify?email=${encodeURIComponent(email)}`
            : "/login";
          return createRedirectResponse(dest);
        }

        const renderError = async (msg: string) => {
          const html = await renderToString(
            <VerifyPage email={email} error={msg} />,
          );
          return createHtmlResponse(html, { status: 400 });
        };

        try {
          const user = await db.verifyOtp(email, code);

          if (!user) {
            return renderError(
              "Invalid or expired code. Please request a new one.",
            );
          }

          const token = await db.createSession(user.email);
          const cookie = makeSessionCookie(token);

          return new Response(null, {
            status: 302,
            headers: {
              Location: "/",
              "Set-Cookie": cookie,
            },
          });
        } catch (err) {
          console.error("[verify] error:", err);
          return renderError("Something went wrong. Please try again.");
        }
      },
    },
  },
};
