import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { db, password as pw } from "@/server/db";
import { createPayout } from "@/server/evopay.server";
import { getSessionConfig, type SessionData } from "./session";

async function requireAdmin() {
  const session = await useSession<SessionData>(getSessionConfig());
  if (session.data.role !== "admin") throw new Error("Não autorizado");
}

export const listarFuncionarios = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const list = await db.listEmployees();
  return list.map(({ passwordHash: _p, ...rest }) => rest);
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(4).max(200),
  pixKey: z.string().trim().min(3).max(200),
  dailyAmount: z.number().nonnegative().max(100000),
  active: z.boolean().optional(),
});

export const criarFuncionario = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => createSchema.parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();
    const existing = await db.getUserByEmail(data.email);
    if (existing) return { ok: false as const, error: "Email já cadastrado" };
    const u = await db.createEmployee({
      name: data.name,
      email: data.email,
      passwordHash: pw.hash(data.password),
      pixKey: data.pixKey,
      dailyAmount: data.dailyAmount,
      active: data.active ?? true,
      role: "funcionario",
    });
    const { passwordHash: _p, ...safe } = u;
    return { ok: true as const, employee: safe };
  });

const updateSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(2).max(120).optional(),
  pixKey: z.string().trim().min(3).max(200).optional(),
  dailyAmount: z.number().nonnegative().max(100000).optional(),
  active: z.boolean().optional(),
  password: z.string().min(4).max(200).optional(),
});

export const atualizarFuncionario = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => updateSchema.parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { id, password, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (password) patch.passwordHash = pw.hash(password);
    const u = await db.updateEmployee(id, patch);
    return { ok: !!u };
  });

const idSchema = z.object({ id: z.string() });

export const excluirFuncionario = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => idSchema.parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();
    const ok = await db.deleteEmployee(data.id);
    return { ok };
  });

export const pagarTodos = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const emps = (await db.listEmployees()).filter((e) => e.active && e.dailyAmount && e.pixKey);
  const results: Array<{ employeeId: string; ok: boolean; error?: string }> = [];
  for (const e of emps) {
    try {
      const payout = await createPayout({
        amount: e.dailyAmount ?? 0,
        pixKey: e.pixKey!,
        beneficiaryName: e.name,
        description: `Diária ${e.name}`,
      });
      await db.createTransaction({
        kind: "pagamento_funcionario",
        status: payout.status,
        amount: e.dailyAmount ?? 0,
        description: `Diária ${e.name}`,
        pixKey: e.pixKey,
        counterparty: e.name,
        employeeId: e.id,
        externalId: payout.externalId,
        paidAt: payout.status === "pago" ? new Date().toISOString() : undefined,
      });
      results.push({ employeeId: e.id, ok: true });
    } catch (err) {
      results.push({ employeeId: e.id, ok: false, error: (err as Error).message });
    }
  }
  const cfg = await db.getAutoPay();
  await db.setAutoPay({ ...cfg, lastRunAt: new Date().toISOString() });
  return { total: emps.length, results };
});

export const obterAutoPay = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  return db.getAutoPay();
});

const autoPaySchema = z.object({
  enabled: z.boolean(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

export const salvarAutoPay = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => autoPaySchema.parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();
    return db.setAutoPay({ ...data });
  });
