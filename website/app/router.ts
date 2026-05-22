import { createRouter } from "remix/router";
import { logger } from "remix/middleware/logger";
import { routes } from "./routes.ts";
import homeController from "./actions/controller.tsx";
import contactController from "./actions/contact/controller.tsx";

export function createWebsiteRouter() {
  let router = createRouter({
    middleware: [logger()],
  });

  router.get(routes.home, homeController);
  router.map(routes.contact, contactController);

  return router;
}
