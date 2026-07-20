import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/server/db";
import {
  createPix,
  createPayout,
  createPayoutByQr,
  decodeQrCode,
  getBalance,
  getPixStatus,
  getWithdrawStatus,
  isMock,
} from "@/server/evopay.server";
import { getSessionData } from "./session.server";

async function requireAdmin() {
  const session = await getSessionData();
  if (!session.userId || session.role !== "admin") {
    throw new Error("Não autorizado");
  }
  return session;
}

async function requireSession() {
  const session = await getSessionData();
  if (!session.userId) throw new Error("Não autorizado");
  return session;
}

const criarPixSchema = z.object({
  amount: z.number().positive().max(100000),
  description: z.string().trim().min(1).max(200),
  payerName: z.string().trim().max(120).optional(),
  payerDocument: z.string().trim().max(20).optional(),
});

export const criarDeposito = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => criarPixSchema.parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();
    const pix = await createPix(data);
    const tx = await db.createTransaction({
      kind: "deposito",
      status: "pendente",
      amount: data.amount,
      description: data.description,
      counterparty: data.payerName ?? "—",
      externalId: pix.externalId,
      qrCode: pix.qrCode,
      qrImage: pix.qrImage,
    });
    return { tx, qrCode: pix.qrCode, qrImage: pix.qrImage };
  });

const sacarSchema = z.object({
  amount: z.number().positive().max(100000),
  pixKey: z.string().trim().min(3).max(200),
  keyType: z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]).optional(),
  beneficiaryName: z.string().trim().max(120).optional(),
  description: z.string().trim().max(200).optional(),
});

export const criarSaque = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => sacarSchema.parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();
    const payout = await createPayout({
      amount: data.amount,
      pixKey: data.pixKey,
      keyType: data.keyType,
      beneficiaryName: data.beneficiaryName ?? "—",
      description: data.description,
    });
    const tx = await db.createTransaction({
      kind: "saque",
      status: payout.status,
      amount: data.amount,
      description: data.description ?? "Saque",
      pixKey: data.pixKey,
      counterparty: data.keyType ?? data.beneficiaryName ?? "—",
      externalId: payout.externalId,
      paidAt: payout.status === "pago" ? new Date().toISOString() : undefined,
    });
    return { tx };
  });

export const consultarSaldo = createServerFn({ method: "GET" }).handler(async () => {
  // Saldo do gateway é sensível — só admin
  await requireAdmin();
  return { ...(await getBalance()), mock: isMock };
});

export const meuSaldoFuncionario = createServerFn({ method: "GET" }).handler(async () => {
  const s = await requireSession();
  const list = await db.listTransactionsForEmployee(s.userId!);
  const recebido = list
    .filter((t) => t.kind === "pagamento_funcionario" && t.status === "pago")
    .reduce((a, b) => a + b.amount, 0);
  const pendente = list
    .filter((t) => t.kind === "pagamento_funcionario" && t.status === "pendente")
    .reduce((a, b) => a + b.amount, 0);
  return { recebido, pendente };
});

const idSchema = z.object({ id: z.string() });

export const atualizarStatusTransacao = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => idSchema.parse(raw))
  .handler(async ({ data }) => {
    await requireSession();
    const tx = await db.getTransaction(data.id);
    if (!tx || !tx.externalId) return { ok: false, tx };
    const remote =
      tx.kind === "deposito"
        ? await getPixStatus(tx.externalId)
        : tx.kind === "saque"
        ? await getWithdrawStatus(tx.externalId)
        : null;
    if (!remote) return { ok: false, tx };
    if (remote.status !== tx.status) {
      const updated = await db.updateTransaction(tx.id, {
        status: remote.status,
        paidAt: remote.status === "pago" ? remote.paidAt ?? new Date().toISOString() : tx.paidAt,
      });
      return { ok: true, tx: updated };
    }
    return { ok: true, tx };
  });

// Simulate payment of a pending deposit — preview convenience.
export const simularPagamento = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => idSchema.parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();
    const tx = await db.getTransaction(data.id);
    if (!tx || tx.kind !== "deposito" || tx.status !== "pendente") return { ok: false };
    await db.updateTransaction(tx.id, { status: "pago", paidAt: new Date().toISOString() });
    return { ok: true };
  });
