import { createRouter } from "remix/router";
import { logger } from "remix/middleware/logger";
import { routes } from "./routes.ts";
import homeController from "./actions/controller.tsx";
import contactController from "./actions/contact/controller.tsx";
import loginController from "./actions/login/controller.tsx";
import loginVerifyController from "./actions/login/verify/controller.tsx";
import logoutController from "./actions/logout/controller.tsx";
import dashboardController from "./actions/dashboard/controller.tsx";
import filterCutListController from "./actions/filter-cut-list/controller.tsx";

export function createWebsiteRouter() {
  let router = createRouter({
    middleware: [logger()],
  });

  router.get(routes.home, homeController);
  router.map(routes.contact, contactController);
  router.map(routes.login, loginController);
  router.map(routes.loginVerify, loginVerifyController);
  router.map(routes.logout, logoutController);
  router.get(routes.dashboard, dashboardController);
  router.get(routes.filterCutList, filterCutListController);

  return router;
}
