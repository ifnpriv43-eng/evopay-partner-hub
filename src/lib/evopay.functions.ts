import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/server/db";
import { createPix, createPayout, getBalance, isMock } from "@/server/evopay.server";
import { getSessionData } from "./session.server";

async function requireAdmin() {
  const session = await getSessionData();
  if (!session.userId || session.role !== "admin") {
    throw new Error("Não autorizado");
  }
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
    const payout = await createPayout({ ...data, beneficiaryName: data.beneficiaryName ?? "—" });
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
  return { ...(await getBalance()), mock: isMock };
});

// Simulate payment of a pending deposit — preview convenience so users can see
// the whole flow without a real webhook.
const simSchema = z.object({ id: z.string() });
export const simularPagamento = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => simSchema.parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();
    const tx = await db.getTransaction(data.id);
    if (!tx || tx.kind !== "deposito" || tx.status !== "pendente") return { ok: false };
    await db.updateTransaction(tx.id, { status: "pago", paidAt: new Date().toISOString() });
    return { ok: true };
  });
