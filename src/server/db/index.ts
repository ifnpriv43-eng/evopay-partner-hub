// Data store selector.
// - Default (Lovable Cloud / VPS): Supabase-backed adapter (persistent).
// - Set DATA_DRIVER=memory to use the ephemeral in-memory store (tests/local).

import { memoryStore, memoryPassword } from "./memory";
import { supabaseStore, supabasePassword } from "./supabase.server";
import type { DataStore } from "./schema";

const driver = process.env.DATA_DRIVER ?? "supabase";

export const db: DataStore = driver === "memory" ? memoryStore : supabaseStore;
export const password = driver === "memory" ? memoryPassword : supabasePassword;

export { driver };
