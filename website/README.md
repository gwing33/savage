# Savage Website

Landing page for the **Savage** smart range air filtration cassette. Built with [Remix v3](https://api.remix.run/).

## Requirements

- Node.js >= 24.3.0 (Remix v3 requires 24.3+ for the node-tsx loader)
- npm

> **Note:** The site was developed on Node 22.22.2 — the beta package engine requirement is 24.3.0 but the server ran successfully on 22 with only a warning. Upgrade to Node 24 for full support.

## Local Development

```bash
npm install
npm run dev     # Start with --watch (auto-restarts on file changes)
npm start       # Start without watch
```

The server listens on **http://localhost:3000** by default.  
Set `PORT=xxxx` to use a different port.

## Docker Compose (recommended for local)

Spins up **SurrealDB** + the **website** together:

```bash
docker compose up          # foreground
docker compose up -d       # background
docker compose down        # stop and remove containers
docker compose down -v     # also remove the surreal_data volume
```

Open **http://localhost:3000**. SurrealDB is accessible on **http://localhost:8000** for tools like [Surrealist](https://surrealdb.com/surrealist).

## Docker (manual)

If you want to run only the website container:

```bash
docker build -t savage-website .
docker run -p 3000:8080 \
  -e SURREAL_URL=ws://host.docker.internal:8000 \
  savage-website
```

## Deploy to fly.io

SurrealDB needs to be deployed separately (e.g. a second fly.io app, SurrealDB Cloud, or any hosted instance). Then:

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/

# 1. Create the app (one time)
fly launch --name savage-website --no-deploy

# 2. Set SurrealDB connection secrets
fly secrets set \
  SURREAL_URL=wss://your-surreal-app.fly.dev \
  SURREAL_USER=root \
  SURREAL_PASS=your-password \
  SURREAL_NS=savage \
  SURREAL_DB=main

# 3. Deploy
fly deploy
```

The `fly.toml` is pre-configured with:
- Internal port `8080`
- 256 MB shared-CPU VM
- Auto-stop/start (zero cost when idle)
- HTTP health check on `GET /`

## Structure

```
website/
├── server.tsx          # Entry point — routes, router, HTTP server
├── db.ts               # SurrealDB client (connects on startup, exports db.saveContact)
├── app/
│   ├── theme.ts        # Remix UI theme (brand token values)
│   └── home.tsx        # Full landing page (all sections as components)
├── Dockerfile          # Two-stage Alpine build for the website
├── fly.toml            # fly.io deployment config
├── package.json
└── tsconfig.json
```

## Landing Page Sections

1. **Nav** — Sticky header with logo and anchor links
2. **Hero** — Product name, tagline, CTA buttons
3. **Features** — 6-card grid describing the product
4. **FAQ** — `<details>`/`<summary>` accordion with 3 Q&As
5. **Contact** — Form that POSTs to `/contact`
6. **Footer** — Copyright

## Contact Form

Submitting the form:
1. Inserts a new record into the `contact` table (name, email, message, created_at)
2. Upserts the email into the `user` table with `type = 'customer'` (idempotent)
3. Redirects to `/?success=true` on success

See `../.env.example` (root) for all connection variables — the SurrealDB section covers these vars.

## Environment Variables

| Variable       | Default                  | Description                         |
|---------------|--------------------------|-------------------------------------|
| `PORT`        | `3000`                   | HTTP port to listen on              |
| `SURREAL_URL` | `ws://localhost:8000`    | SurrealDB WebSocket URL             |
| `SURREAL_USER`| `root`                   | SurrealDB username                  |
| `SURREAL_PASS`| `root`                   | SurrealDB password                  |
| `SURREAL_NS`  | `savage`                 | SurrealDB namespace                 |
| `SURREAL_DB`  | `main`                   | SurrealDB database                  |
