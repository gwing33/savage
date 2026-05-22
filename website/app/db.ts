import { Surreal, Table } from "surrealdb";

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

export const db = {
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
