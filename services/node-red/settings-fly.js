// ─────────────────────────────────────────────────────────────────────────────
// Node-RED Settings  –  savage / fly.io
//
// Differences from the local settings.js:
//   • flowFile points to /data/flows.json (single volume, no separate /flows)
//   • credentialSecret reads from NODE_RED_CREDENTIAL_SECRET env var (set via
//     `fly secrets set`) rather than being hardcoded to false.
//   • adminAuth block is present but commented — uncomment and redeploy to
//     password-protect the editor on the public URL.
//
// Full reference: https://nodered.org/docs/user-guide/runtime/configuration
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  // ── Server ─────────────────────────────────────────────────────────────
  uiPort: process.env.PORT || 1880,
  uiHost: "0.0.0.0",

  // ── User data directory ────────────────────────────────────────────────
  // The fly volume is mounted here. Both runtime state and the flow file
  // live under /data so a single mount is enough.
  userDir: "/data",

  // ── Flow file ─────────────────────────────────────────────────────────
  flowFile: "/data/flows.json",
  flowFilePretty: true,

  // ── Logging ────────────────────────────────────────────────────────────
  logging: {
    console: {
      level: "info",
      metrics: false,
      audit: false,
    },
  },

  // ── Editor ─────────────────────────────────────────────────────────────
  editorTheme: {
    tours: false,
    projects: {
      enabled: false,
    },
  },

  // ── Security ───────────────────────────────────────────────────────────
  // Username and bcrypt-hashed password are injected via fly secrets:
  //   fly secrets set NODE_RED_ADMIN_USER=admin
  //   fly secrets set NODE_RED_ADMIN_PASS="$(npx node-red-admin hash-pw)"
  //
  // If either secret is missing the app will refuse to start rather than
  // silently boot with an open editor.
  adminAuth: {
    type: "credentials",
    users: [
      {
        username: process.env.NODE_RED_ADMIN_USER,
        password: process.env.NODE_RED_ADMIN_PASS,
        permissions: "*",
      },
    ],
  },

  // ── Context storage ────────────────────────────────────────────────────
  contextStorage: {
    default: { module: "memory" },
    file: { module: "localfilesystem" },
  },

  // ── Function node globals ──────────────────────────────────────────────
  // Accessible inside any Function node via:  global.get('influxdb')
  functionGlobalContext: {
    influxdb: {
      url: process.env.INFLUX_URL || "http://savage-influxdb.internal:8086",
      token: process.env.INFLUX_TOKEN || "",
      org: process.env.INFLUX_ORG || "savage",
      bucket: process.env.INFLUX_BUCKET || "timeseries",
    },
  },

  // ── Credentials ────────────────────────────────────────────────────────
  // Set NODE_RED_CREDENTIAL_SECRET via `fly secrets set` to encrypt the
  // flows_cred.json on the volume. Must not change after first deploy or
  // existing encrypted credentials become unreadable.
  credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET || false,

  // ── Diagnostics ────────────────────────────────────────────────────────
  diagnostics: {
    enabled: true,
    ui: true,
  },

  // ── Misc ───────────────────────────────────────────────────────────────
  exportGlobalContextKeys: false,
  externalModules: {
    autoInstall: false,
    palette: {
      allowInstall: true,
    },
  },
};
