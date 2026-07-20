// Data store selector. Uses in-memory adapter by default (Lovable preview).
// On your VPS, set DATA_DRIVER=sqlite in the .env and see DEPLOY.md for
// wiring the SQLite adapter (better-sqlite3 is Node-only).

import { memoryStore, memoryPassword } from "./memory";
import type { DataStore } from "./schema";

const driver = process.env.DATA_DRIVER ?? "memory";

// Only "memory" is bundled by default so the Cloudflare Workers preview works.
// To enable sqlite on your VPS, uncomment the sqlite import + branch below and
// install better-sqlite3 + bcryptjs (see DEPLOY.md).
export const db: DataStore = memoryStore;

export const password = memoryPassword;

export { driver };
