import http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";
import { createWebsiteRouter } from "./app/router.ts";

let router = createWebsiteRouter();
let port = Number(process.env.PORT ?? 3000);

let server = http.createServer(
  createRequestListener((req) => router.fetch(req)),
);

server.listen(port, () => {
  console.log(`Savage website running → http://localhost:${port}`);
});
