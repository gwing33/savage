import { Surreal, Table } from "surrealdb";
import { generateOtp, generateToken } from "./auth.ts";

const SURREAL_URL = process.env.SURREAL_URL ?? "ws://localhost:8000";
const SURREAL_USER = process.env.SURREAL_USER ?? "root";
const SURREAL_PASS = process.env.SURREAL_PASS ?? "root";
const SURREAL_NS = process.env.SURREAL_NS ?? "savage";
const SURREAL_DB = process.env.SURREAL_DB ?? "main";

type Session = Awaited<ReturnType<InstanceType<typeof Surreal>["newSession"]>>;

async function connect(retries = 10, delayMs = 2_000): Promise<Session> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = new Surreal();
      await client.connect(SURREAL_URL);
      const session = await client.newSession();
      await session.signin({ username: SURREAL_USER, password: SURREAL_PASS });
      await session.use({ namespace: SURREAL_NS, database: SURREAL_DB });
      console.log(`[db] Connected to SurrealDB at ${SURREAL_URL}`);
      return session;
    } catch (err) {
      if (attempt === retries) {
        throw new Error(
          `[db] Could not connect to SurrealDB after ${retries} attempts: ${err}`,
        );
      }
      console.warn(
        `[db] Attempt ${attempt}/${retries} failed — retrying in ${delayMs}ms…`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("[db] unreachable");
}

// Kick off the connection immediately at module load, but store it as a
// promise rather than top-level await. Each db call awaits this promise, so
// the first call blocks until connected while Node.js stays happy.
const sessionPromise: Promise<Session> = connect();

const contactTable = new Table("contact");

// ── Auth constants ────────────────────────────────────────────────────────────
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_TTL_DAYS = 30;

export const db = {
  // ── Auth ────────────────────────────────────────────────────────────────────

  /**
   * Generate a 6-digit OTP for the given email, persist it with a 10-minute
   * TTL, and return the plain-text code to be emailed to the user.
   */
  async createOtp(email: string): Promise<string> {
    const session = await sessionPromise;
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS); // Date object → SurrealDB datetime
    await session.query(
      `INSERT INTO otp_code {
         email: $email,
         code: $code,
         expires_at: $expiresAt,
         used: false,
         created_at: time::now()
       }`,
      { email, code, expiresAt },
    );
    return code;
  },

  /**
   * Verify an OTP code for a given email.
   * - Returns the user record if valid (creating the user as 'customer' on
   *   first login and preserving any existing type for returning users).
   * - Returns null if the code is wrong, expired, or already used.
   */
  async verifyOtp(
    email: string,
    code: string,
  ): Promise<{ email: string; type: string } | null> {
    const session = await sessionPromise;

    // Find the latest unused, unexpired OTP for this email.
    const otpResult = await session.query<any[][]>(
      `SELECT * FROM otp_code
         WHERE email = $email
           AND used   = false
           AND expires_at > time::now()
         ORDER BY created_at DESC
         LIMIT 1`,
      { email },
    );
    const otp = otpResult?.[0]?.[0];
    if (!otp || otp.code !== code) return null;

    // Consume the OTP so it can't be reused.
    await session.query("UPDATE $id SET used = true", { id: otp.id });

    // Find an existing user (preserves admin / super roles).
    const userResult = await session.query<any[][]>(
      "SELECT * FROM user WHERE email = $email LIMIT 1",
      { email },
    );
    let user = userResult?.[0]?.[0];

    if (!user) {
      // First-ever login — create the user as a customer.
      const created = await session.query<any[][]>(
        `CREATE type::record("user", $email)
           SET email      = $email,
               type       = "customer",
               created_at = time::now()`,
        { email },
      );
      user = created?.[0]?.[0];
    }

    return user ? { email: user.email, type: user.type ?? "customer" } : null;
  },

  /**
   * Create a 30-day session for the given email and return the opaque token
   * that should be stored in the browser as an HttpOnly cookie.
   */
  async createSession(email: string): Promise<string> {
    const session = await sessionPromise;
    const token = generateToken();
    const expiresAt = new Date(
      Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    ); // Date object → SurrealDB datetime
    await session.query(
      `INSERT INTO user_session {
         token:      $sess_token,
         email:      $email,
         expires_at: $expiresAt,
         created_at: time::now()
       }`,
      { sess_token: token, email, expiresAt },
    );
    return token;
  },

  /**
   * Look up the user associated with a session token.
   * Returns null if the token is missing, expired, or the user no longer exists.
   */
  async getSessionUser(
    token: string,
  ): Promise<{ email: string; type: string } | null> {
    const session = await sessionPromise;

    const sessResult = await session.query<any[][]>(
      `SELECT * FROM user_session
         WHERE token = $sess_token
           AND expires_at > time::now()
         LIMIT 1`,
      { sess_token: token },
    );
    const sess = sessResult?.[0]?.[0];
    if (!sess) return null;

    const userResult = await session.query<any[][]>(
      "SELECT * FROM user WHERE email = $email LIMIT 1",
      { email: sess.email },
    );
    const user = userResult?.[0]?.[0];
    return user ? { email: user.email, type: user.type ?? "customer" } : null;
  },

  /**
   * Delete a session token (logout).
   */
  async deleteSession(token: string): Promise<void> {
    const session = await sessionPromise;
    await session.query("DELETE FROM user_session WHERE token = $sess_token", {
      sess_token: token,
    });
  },

  // ── Contact ───────────────────────────────────────────────────────────────

  async saveContact(
    name: string,
    email: string,
    message: string,
  ): Promise<void> {
    const session = await sessionPromise;

    // Insert a new contact record (auto-generated ID).
    await session.insert(contactTable, {
      name,
      email,
      message,
      created_at: new Date().toISOString(),
    });

    // Upsert the user keyed by email — idempotent, always sets type = 'customer'.
    await session.query(
      'UPSERT type::record("user", $email) SET email = $email, type = "customer"',
      { email },
    );
  },
};
