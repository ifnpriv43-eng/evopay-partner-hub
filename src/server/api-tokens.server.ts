// Server-only: helpers para tokens de API pessoais.
// Nunca importar em bundles client.
import { createHash, randomBytes } from "crypto";

const TOKEN_PREFIX = "pk_live_";
const usePg = () => !!process.env.DATABASE_URL;

export interface ApiTokenRow {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  token_last4: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ApiTokenPublic {
  id: string;
  name: string;
  last4: string;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateToken(): { raw: string; hash: string; last4: string } {
  const raw = TOKEN_PREFIX + randomBytes(24).toString("base64url");
  return { raw, hash: hashToken(raw), last4: raw.slice(-4) };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function pg() {
  const { getSql } = await import("@/server/db/pg.server");
  return getSql();
}

function toIso(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return new Date(v as string).toISOString();
}
function normalizeRow(r: ApiTokenRow): ApiTokenRow {
  return { ...r, created_at: toIso(r.created_at), last_used_at: r.last_used_at ? toIso(r.last_used_at) : null, revoked_at: r.revoked_at ? toIso(r.revoked_at) : null };
}

export function rowToPublic(r: ApiTokenRow): ApiTokenPublic {
  return {
    id: r.id, name: r.name, last4: r.token_last4, active: r.active,
    createdAt: r.created_at, lastUsedAt: r.last_used_at, revokedAt: r.revoked_at,
  };
}

export async function listTokens(userId: string): Promise<ApiTokenPublic[]> {
  if (usePg()) {
    const sql = await pg();
    const rows = await sql<ApiTokenRow[]>`
      SELECT * FROM api_tokens WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows.map((r) => rowToPublic(normalizeRow(r)));
  }
  const sb = await admin();
  // deno-lint-ignore no-explicit-any
  const { data } = await (sb.from as any)("api_tokens")
    .select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return ((data ?? []) as ApiTokenRow[]).map(rowToPublic);
}

export async function createToken(userId: string, name: string): Promise<{ token: string; row: ApiTokenPublic }> {
  const { raw, hash, last4 } = generateToken();
  const row: ApiTokenRow = {
    id: uid("apitk"), user_id: userId, name, token_hash: hash, token_last4: last4,
    active: true, created_at: new Date().toISOString(), last_used_at: null, revoked_at: null,
  };
  if (usePg()) {
    const sql = await pg();
    const rows = await sql<ApiTokenRow[]>`
      INSERT INTO api_tokens (id, user_id, name, token_hash, token_last4, active, created_at)
      VALUES (${row.id}, ${row.user_id}, ${row.name}, ${row.token_hash}, ${row.token_last4}, ${row.active}, ${row.created_at})
      RETURNING *`;
    return { token: raw, row: rowToPublic(normalizeRow(rows[0])) };
  }
  const sb = await admin();
  // deno-lint-ignore no-explicit-any
  const { data, error } = await (sb.from as any)("api_tokens").insert(row).select("*").single();
  if (error) throw error;
  return { token: raw, row: rowToPublic(data as ApiTokenRow) };
}

export async function revokeToken(userId: string, id: string): Promise<boolean> {
  if (usePg()) {
    const sql = await pg();
    const rows = await sql`
      UPDATE api_tokens SET active = false, revoked_at = now()
      WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
    return rows.length > 0;
  }
  const sb = await admin();
  // deno-lint-ignore no-explicit-any
  const { error } = await (sb.from as any)("api_tokens")
    .update({ active: false, revoked_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", userId);
  return !error;
}

export interface AuthedApiToken {
  userId: string;
  tokenId: string;
}

/** Resolve o Bearer token do header pro user_id do dono. Retorna null se inválido/revogado. */
export async function authenticateApiToken(request: Request): Promise<AuthedApiToken | null> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const raw = match[1].trim();
  if (!raw.startsWith(TOKEN_PREFIX)) return null;
  const hash = hashToken(raw);

  if (usePg()) {
    const sql = await pg();
    const rows = await sql<{ id: string; user_id: string; active: boolean; revoked_at: string | null }[]>`
      SELECT id, user_id, active, revoked_at FROM api_tokens WHERE token_hash = ${hash} LIMIT 1`;
    const row = rows[0];
    if (!row || !row.active || row.revoked_at) return null;
    sql`UPDATE api_tokens SET last_used_at = now() WHERE id = ${row.id}`.catch(() => {});
    return { userId: row.user_id, tokenId: row.id };
  }

  const sb = await admin();
  // deno-lint-ignore no-explicit-any
  const { data } = await (sb.from as any)("api_tokens")
    .select("id, user_id, active, revoked_at").eq("token_hash", hash).maybeSingle();
  const row = data as { id: string; user_id: string; active: boolean; revoked_at: string | null } | null;
  if (!row || !row.active || row.revoked_at) return null;
  // deno-lint-ignore no-explicit-any
  (sb.from as any)("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id)
    .then(() => {}, () => {});
  return { userId: row.user_id, tokenId: row.id };
}

/** Erro JSON padrão da API. */
export function apiError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function apiJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
