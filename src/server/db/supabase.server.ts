// Supabase-backed data store. Server-only. Uses the admin client (service role)
// because our app has its own session/auth layer on top — RLS bypass is intentional.

import type { AutoPayConfig, DataStore, Transaction, TxKind, TxStatus, User, UserRole } from "./schema";

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function simpleHash(pw: string) {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) h = ((h << 5) + h) ^ pw.charCodeAt(i);
  return `sh1$${(h >>> 0).toString(16)}$${pw.length}`;
}

function verifySimple(pw: string, hash: string) {
  return simpleHash(pw) === hash;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// row <-> domain
type UserRow = {
  id: string; email: string; name: string; password_hash: string; role: UserRole;
  pix_key: string | null; daily_amount: number | null; active: boolean; created_at: string;
};
function userFromRow(r: UserRow): User {
  return {
    id: r.id, email: r.email, name: r.name, passwordHash: r.password_hash, role: r.role,
    pixKey: r.pix_key ?? undefined,
    dailyAmount: r.daily_amount == null ? undefined : Number(r.daily_amount),
    active: r.active, createdAt: r.created_at,
  };
}
function userToRow(u: Partial<User>): Partial<UserRow> {
  const row: Partial<UserRow> = {};
  if (u.id !== undefined) row.id = u.id;
  if (u.email !== undefined) row.email = u.email;
  if (u.name !== undefined) row.name = u.name;
  if (u.passwordHash !== undefined) row.password_hash = u.passwordHash;
  if (u.role !== undefined) row.role = u.role;
  if (u.pixKey !== undefined) row.pix_key = u.pixKey ?? null;
  if (u.dailyAmount !== undefined) row.daily_amount = u.dailyAmount ?? null;
  if (u.active !== undefined) row.active = u.active;
  return row;
}

type TxRow = {
  id: string; kind: TxKind; status: TxStatus; amount: number; description: string;
  counterparty: string | null; pix_key: string | null; qr_code: string | null; qr_image: string | null;
  external_id: string | null; employee_id: string | null; created_at: string; paid_at: string | null;
};
function txFromRow(r: TxRow): Transaction {
  return {
    id: r.id, kind: r.kind, status: r.status, amount: Number(r.amount), description: r.description,
    counterparty: r.counterparty ?? undefined, pixKey: r.pix_key ?? undefined,
    qrCode: r.qr_code ?? undefined, qrImage: r.qr_image ?? undefined,
    externalId: r.external_id ?? undefined, employeeId: r.employee_id ?? undefined,
    createdAt: r.created_at, paidAt: r.paid_at ?? undefined,
  };
}
function txToRow(t: Partial<Transaction>): Partial<TxRow> {
  const row: Partial<TxRow> = {};
  if (t.id !== undefined) row.id = t.id;
  if (t.kind !== undefined) row.kind = t.kind;
  if (t.status !== undefined) row.status = t.status;
  if (t.amount !== undefined) row.amount = t.amount;
  if (t.description !== undefined) row.description = t.description;
  if (t.counterparty !== undefined) row.counterparty = t.counterparty ?? null;
  if (t.pixKey !== undefined) row.pix_key = t.pixKey ?? null;
  if (t.qrCode !== undefined) row.qr_code = t.qrCode ?? null;
  if (t.qrImage !== undefined) row.qr_image = t.qrImage ?? null;
  if (t.externalId !== undefined) row.external_id = t.externalId ?? null;
  if (t.employeeId !== undefined) row.employee_id = t.employeeId ?? null;
  if (t.paidAt !== undefined) row.paid_at = t.paidAt ?? null;
  return row;
}

export const supabaseStore: DataStore = {
  async getUserByEmail(email) {
    const sb = await admin();
    const { data } = await sb.from("app_users").select("*").ilike("email", email).maybeSingle();
    return data ? userFromRow(data as UserRow) : null;
  },
  async getUserById(id) {
    const sb = await admin();
    const { data } = await sb.from("app_users").select("*").eq("id", id).maybeSingle();
    return data ? userFromRow(data as UserRow) : null;
  },
  async listEmployees() {
    const sb = await admin();
    const { data } = await sb.from("app_users").select("*").eq("role", "funcionario").order("created_at", { ascending: false });
    return (data ?? []).map((r) => userFromRow(r as UserRow));
  },
  async createEmployee(input) {
    const sb = await admin();
    const row: UserRow = {
      id: uid("u"),
      email: input.email,
      name: input.name,
      password_hash: input.passwordHash,
      role: (input.role ?? "funcionario") as UserRole,
      pix_key: input.pixKey ?? null,
      daily_amount: input.dailyAmount ?? null,
      active: input.active ?? true,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from("app_users").insert(row as never).select("*").single();
    if (error) throw error;
    return userFromRow(data as UserRow);
  },
  async updateEmployee(id, patch) {
    const sb = await admin();
    const { data } = await sb.from("app_users").update(userToRow(patch) as never).eq("id", id).select("*").maybeSingle();
    return data ? userFromRow(data as UserRow) : null;
  },
  async deleteEmployee(id) {
    const sb = await admin();
    const { error } = await sb.from("app_users").delete().eq("id", id);
    return !error;
  },

  async listTransactions(filter) {
    const sb = await admin();
    let q = sb.from("app_transactions").select("*").order("created_at", { ascending: false });
    if (filter?.kind) q = q.eq("kind", filter.kind);
    if (filter?.status) q = q.eq("status", filter.status);
    if (filter?.limit) q = q.limit(filter.limit);
    const { data } = await q;
    return (data ?? []).map((r) => txFromRow(r as TxRow));
  },
  async listTransactionsForEmployee(employeeId) {
    const sb = await admin();
    const { data } = await sb.from("app_transactions").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
    return (data ?? []).map((r) => txFromRow(r as TxRow));
  },
  async getTransaction(id) {
    const sb = await admin();
    const { data } = await sb.from("app_transactions").select("*").eq("id", id).maybeSingle();
    return data ? txFromRow(data as TxRow) : null;
  },
  async getTransactionByExternalId(externalId) {
    const sb = await admin();
    const { data } = await sb.from("app_transactions").select("*").eq("external_id", externalId).maybeSingle();
    return data ? txFromRow(data as TxRow) : null;
  },
  async createTransaction(tx) {
    const sb = await admin();
    const row = {
      ...txToRow(tx),
      id: uid("tx"),
      created_at: new Date().toISOString(),
    } as TxRow;
    const { data, error } = await sb.from("app_transactions").insert(row as never).select("*").single();
    if (error) throw error;
    return txFromRow(data as TxRow);
  },
  async updateTransaction(id, patch) {
    const sb = await admin();
    const { data } = await sb.from("app_transactions").update(txToRow(patch) as never).eq("id", id).select("*").maybeSingle();
    return data ? txFromRow(data as TxRow) : null;
  },

  async getAutoPay() {
    const sb = await admin();
    const { data } = await sb.from("app_config").select("value").eq("key", "autopay").maybeSingle();
    const v = (data?.value ?? {}) as Partial<AutoPayConfig>;
    return { enabled: !!v.enabled, hour: v.hour ?? 9, minute: v.minute ?? 0, lastRunAt: v.lastRunAt };
  },
  async setAutoPay(cfg) {
    const sb = await admin();
    await sb.from("app_config").upsert({ key: "autopay", value: cfg as unknown as Record<string, unknown>, updated_at: new Date().toISOString() } as never);
    return cfg;
  },
};

export const supabasePassword = {
  hash: (pw: string) => simpleHash(pw),
  verify: verifySimple,
};
