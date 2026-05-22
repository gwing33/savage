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
  // Uncomment to protect the editor on the public fly.io URL.
  // Generate a bcrypt hash with:  npx node-red-admin hash-pw
  // Then set NODE_RED_ADMIN_PASS as a fly secret and reference it here, or
  // just paste the hash directly (it is not a plaintext password).
  //
  // adminAuth: {
  //   type: "credentials",
  //   users: [
  //     {
  //       username: "admin",
  //       password: "$2b$08$<bcrypt-hash>",
  //       permissions: "*",
  //     },
  //   ],
  // },

  // ── Context storage ────────────────────────────────────────────────────
  contextStorage: {
    default: { module: "memory" },
    file:    { module: "localfilesystem" },
  },

  // ── Function node globals ──────────────────────────────────────────────
  // Accessible inside any Function node via:  global.get('influxdb')
  functionGlobalContext: {
    influxdb: {
      url:    process.env.INFLUX_URL    || "http://savage-influxdb.internal:8086",
      token:  process.env.INFLUX_TOKEN  || "",
      org:    process.env.INFLUX_ORG    || "savage",
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
