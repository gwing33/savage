import { route, form } from "remix/routes";

export const routes = route({
  home: "/",
  contact: form("contact"),
  login: form("login"),
  loginVerify: form("login/verify"),
  logout: form("logout"),
  dashboard: "/dashboard",
  filterCutList: "/filter-cut-list",
  fanBox: "/fan-box",
  fanBoxDrawings: "/fan-box-drawings",
});
