import { createHtmlResponse } from "remix/response/html";
import { createRedirectResponse } from "remix/response/redirect";
import { renderToString } from "remix/ui/server";
import { db } from "../../db.ts";
import { sendMail } from "../../mailer.ts";
import { getSessionToken } from "../../auth.ts";
import { LoginPage } from "../../login.tsx";

export default {
  actions: {
    // GET /login — render the email input form.
    // If the visitor already has a valid session, send them home.
    index: async (context: any) => {
      const token = getSessionToken(context.request);
      if (token) {
        const user = await db.getSessionUser(token).catch(() => null);
        if (user) return createRedirectResponse("/");
      }
      const html = await renderToString(<LoginPage />);
      return createHtmlResponse(html);
    },

    action: {
      // POST /login — validate the email, create an OTP, send it, then
      // redirect to the verify page.
      handler: async (context: any) => {
        const fd = await context.request.formData();
        const email = (fd.get("email") ?? "").toString().trim().toLowerCase();

        if (!email || !email.includes("@")) {
          const html = await renderToString(
            <LoginPage error="Please enter a valid email address." />,
          );
          return createHtmlResponse(html, { status: 400 });
        }

        try {
          const code = await db.createOtp(email);

          await sendMail({
            to: email,
            subject: "Your Savage sign-in code",
            text: `Your one-time sign-in code is: ${code}\n\nIt expires in 10 minutes. If you didn't request this, you can ignore this email.`,
            html: `
              <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px">
                <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;letter-spacing:-0.02em">
                  Your Savage sign-in code
                </h2>
                <p style="margin:0 0 32px;font-size:14px;color:#64748b;line-height:1.6">
                  Use the code below to log in. It expires in 10&nbsp;minutes.
                </p>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:28px;text-align:center;margin-bottom:32px">
                  <span style="font-family:ui-monospace,monospace;font-size:36px;font-weight:700;letter-spacing:0.25em;color:#0f172a">
                    ${code}
                  </span>
                </div>
                <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6">
                  If you didn't request this code, you can safely ignore this email.
                </p>
              </div>
            `,
          });

          const dest = `/login/verify?email=${encodeURIComponent(email)}`;
          return createRedirectResponse(dest);
        } catch (err) {
          console.error("[login] OTP send error:", err);
          const html = await renderToString(
            <LoginPage error="Something went wrong. Please try again." />,
          );
          return createHtmlResponse(html, { status: 500 });
        }
      },
    },
  },
};
