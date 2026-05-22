import { createHtmlResponse } from "remix/response/html";
import { renderToString } from "remix/ui/server";
import { HomePage } from "../home.tsx";

export default async function homeController(context: any) {
  let success = context.url.searchParams.get("success") === "true";
  let html = await renderToString(<HomePage success={success} />);
  return createHtmlResponse(html);
}
