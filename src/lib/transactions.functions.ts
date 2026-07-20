import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { db } from "@/server/db";
import { getSessionData } from "./session.server";
import type { TxKind, TxStatus } from "@/server/db/schema";

async function requireSession() {
  const session = await getSessionData();
  if (!session.userId) throw new Error("Não autorizado");
  return session;
}

const filterSchema = z.object({
  kind: z.enum(["deposito", "saque", "pagamento_funcionario"]).optional(),
  status: z.enum(["pendente", "pago", "expirado", "falhou"]).optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const listarTransacoes = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => filterSchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const s = await requireSession();
    if (s.role === "funcionario") {
      return db.listTransactionsForEmployee(s.userId!);
    }
    return db.listTransactions(data as { kind?: TxKind; status?: TxStatus; limit?: number });
  });

export const resumoDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const s = await requireSession();
  const all =
    s.role === "funcionario"
      ? await db.listTransactionsForEmployee(s.userId!)
      : await db.listTransactions();

  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = new Date().toISOString().slice(0, 7);

  const depositosHoje = all
    .filter((t) => t.kind === "deposito" && t.status === "pago" && (t.paidAt ?? "").startsWith(today))
    .reduce((a, b) => a + b.amount, 0);

  const saquesMes = all
    .filter((t) => t.kind === "saque" && t.status === "pago" && (t.paidAt ?? "").startsWith(monthPrefix))
    .reduce((a, b) => a + b.amount, 0);

  const pendentes = all.filter((t) => t.status === "pendente").length;

  // last 30 days by day
  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    byDay.set(d, 0);
  }
  for (const t of all) {
    if (t.kind === "deposito" && t.status === "pago" && t.paidAt) {
      const day = t.paidAt.slice(0, 10);
      if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + t.amount);
    }
  }
  const chart = Array.from(byDay.entries()).map(([date, valor]) => ({ date, valor }));

  return {
    depositosHoje,
    saquesMes,
    pendentes,
    recentes: all.slice(0, 10),
    chart,
  };
});
