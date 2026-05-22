import { createHtmlResponse } from "remix/response/html";
import { createRedirectResponse } from "remix/response/redirect";
import { renderToString } from "remix/ui/server";
import { db } from "../../db.ts";
import { getSessionToken } from "../../auth.ts";
import { DashboardPage } from "../../dashboard.tsx";

export default async function dashboardController(context: any) {
  const token = getSessionToken(context.request);
  if (!token) return createRedirectResponse("/login");

  const user = await db.getSessionUser(token).catch(() => null);
  if (!user) return createRedirectResponse("/login");

  const html = await renderToString(<DashboardPage user={user} />);
  return createHtmlResponse(html);
}
