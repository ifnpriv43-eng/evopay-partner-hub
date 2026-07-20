// Data store selector.
// - Default: Supabase-backed adapter (persistent, works in Lovable Cloud & VPS).
// - DATA_DRIVER=memory → ephemeral in-memory store (tests / offline dev).
//
// Note: server-only adapters are lazy-imported inside method calls so that
// `.functions.ts` files (which ship shells to the client) don't drag
// `client.server` into the client bundle.

import { memoryStore, memoryPassword } from "./memory";
import type { DataStore } from "./schema";

const driver = process.env.DATA_DRIVER ?? "supabase";

async function resolve(): Promise<{ store: DataStore; password: typeof memoryPassword }> {
  if (driver === "memory") return { store: memoryStore, password: memoryPassword };
  const mod = await import("./supabase.server");
  return { store: mod.supabaseStore, password: mod.supabasePassword };
}

// Proxy: each DataStore method call resolves the real adapter lazily.
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
  hash: (pw: string) => {
    if (driver === "memory") return memoryPassword.hash(pw);
    // simpleHash is identical in both adapters
    return memoryPassword.hash(pw);
  },
  verify: (pw: string, hash: string) => memoryPassword.verify(pw, hash),
};

export { driver };
