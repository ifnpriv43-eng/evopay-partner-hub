// Data store selector.
// - DATABASE_URL setada → adapter Postgres self-hosted (VPS).
// - DATA_DRIVER=memory → ephemeral in-memory store (tests / offline).
// - Padrão (Lovable preview) → adapter Supabase.
//
// Adapters server-only são carregados de forma preguiçosa dentro de cada
// chamada para não vazar `client.server` nos bundles do cliente.

import { memoryStore, memoryPassword } from "./memory";
import type { DataStore } from "./schema";

const explicit = process.env.DATA_DRIVER;
const driver =
  explicit ??
  (process.env.DATABASE_URL ? "postgres" : "supabase");

async function resolve(): Promise<{ store: DataStore; password: typeof memoryPassword }> {
  if (driver === "memory") return { store: memoryStore, password: memoryPassword };
  if (driver === "postgres") {
    const mod = await import("./postgres.server");
    return { store: mod.postgresStore, password: mod.postgresPassword };
  }
  const mod = await import("./supabase.server");
  return { store: mod.supabaseStore, password: mod.supabasePassword };
}

// Proxy: cada método resolve o adapter real na hora da chamada.
export const db: DataStore = new Proxy({} as DataStore, {
  get(_t, prop: string) {
    return async (...args: unknown[]) => {
      const { store } = await resolve();
      // deno-lint-ignore no-explicit-any
      return (store as any)[prop](...args);
    };
  },
}) as DataStore;

export const password = {
  hash: (pw: string) => memoryPassword.hash(pw),
  verify: (pw: string, hash: string) => memoryPassword.verify(pw, hash),
};

export { driver };
