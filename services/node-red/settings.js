// ─────────────────────────────────────────────────────────────────────────────
// Node-RED Settings  –  savage
//
// Full reference: https://nodered.org/docs/user-guide/runtime/configuration
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  // ── Server ─────────────────────────────────────────────────────────────
  uiPort: process.env.PORT || 1880,
  uiHost: "0.0.0.0",

  // ── User data directory ────────────────────────────────────────────────
  // Matches the bind-mount in docker-compose.yml
  userDir: "/data",

  // ── Flow file ────────────────────────────────────────────────────────
  // Absolute path into the dedicated /flows bind-mount (see docker-compose.yml).
  // Keeping flows outside /data means they survive `make clean` and can be
  // committed to git. Node-RED also writes flows_cred.json alongside this file.
  flowFile: "/flows/flows.json",
  flowFilePretty: true,

  // ── Logging ────────────────────────────────────────────────────────────
  logging: {
    console: {
      level: "info", // trace | debug | info | warn | error
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
  // Uncomment and populate to enable username/password login.
  // Generate a bcrypt hash with:  node-red admin hash-pw
  //
  // adminAuth: {
  //     type: "credentials",
  //     users: [
  //         {
  //             username: "admin",
  //             password: "$2b$08$<bcrypt-hash>",
  //             permissions: "*",
  //         },
  //     ],
  // },

  // ── Context storage ────────────────────────────────────────────────────
  contextStorage: {
    default: { module: "memory" },
    file: { module: "localfilesystem" },
  },

  // ── Function node globals ──────────────────────────────────────────────
  // Accessible inside any Function node via:  global.get('influxdb')
  functionGlobalContext: {
    influxdb: {
      url: process.env.INFLUX_URL || "http://influxdb:8086",
      token: process.env.INFLUX_TOKEN || "savage-influx-token",
      org: process.env.INFLUX_ORG || "savage",
      bucket: process.env.INFLUX_BUCKET || "timeseries",
    },
  },

  // ── Diagnostics ────────────────────────────────────────────────────────
  diagnostics: {
    enabled: true,
    ui: true,
  },

  // ── Credentials ────────────────────────────────────────────────────────
  // Set to false so Node-RED stores credentials as plain JSON in
  // flows_cred.json rather than encrypting them with a random per-boot key.
  // This lets `make dev` seed the credential file from a known template.
  // In production, set this to a long random secret string instead.
  credentialSecret: false,

  // ── Misc ───────────────────────────────────────────────────────────────
  exportGlobalContextKeys: false,
  externalModules: {
    autoInstall: false,
    palette: {
      allowInstall: true,
    },
  },
};
