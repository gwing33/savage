import { createHtmlResponse } from "remix/response/html";
import { createRedirectResponse } from "remix/response/redirect";
import { renderToString } from "remix/ui/server";
import { db } from "../../db.ts";
import { HomePage } from "../../home.tsx";

export default {
  actions: {
    index: () => createRedirectResponse("/"),

    action: {
      handler: async (context: any) => {
        const fd = await context.request.formData();

        let name = (fd.get("name") ?? "").toString().trim();
        let email = (fd.get("email") ?? "").toString().trim();
        let message = (fd.get("message") ?? "").toString().trim();

        if (!name || !email || !message) {
          let html = await renderToString(
            <HomePage error="All fields are required." />,
          );
          return createHtmlResponse(html, { status: 400 });
        }

        if (!email.includes("@")) {
          let html = await renderToString(
            <HomePage error="Please enter a valid email address." />,
          );
          return createHtmlResponse(html, { status: 400 });
        }

        try {
          await db.saveContact(name, email, message);
          return createRedirectResponse("/?success=true");
        } catch (err) {
          console.error("Contact save error:", err);
          let html = await renderToString(
            <HomePage error="Something went wrong. Please try again." />,
          );
          return createHtmlResponse(html, { status: 500 });
        }
      },
    },
  },
};
