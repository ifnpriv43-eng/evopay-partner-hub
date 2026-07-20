// EvoPay HTTP wrapper. When EVOPAY_TOKEN is set, calls the real gateway;
// otherwise returns realistic mock data so the UI is fully explorable in
// the Lovable preview. See https://docs.partners.evopay.cash/llms-full.txt

const BASE = process.env.EVOPAY_BASE_URL ?? "https://api.partners.evopay.cash";
const TOKEN = process.env.EVOPAY_TOKEN;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!TOKEN) throw new Error("EVOPAY_TOKEN not configured");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`EvoPay ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface CreatePixInput {
  amount: number;
  description: string;
  payerName?: string;
  payerDocument?: string;
}

export interface CreatePixResult {
  externalId: string;
  qrCode: string;
  qrImage?: string;
  expiresAt?: string;
}

export async function createPix(input: CreatePixInput): Promise<CreatePixResult> {
  if (!TOKEN) {
    // Mock — fully functional UX in preview
    const id = `mock_${Date.now().toString(36)}`;
    return {
      externalId: id,
      qrCode: `00020126580014BR.GOV.BCB.PIX0136${id}5204000053039865802BR5913EvoPayMock6009SaoPaulo62070503***6304ABCD`,
      qrImage: undefined,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }
  return call<CreatePixResult>("/v1/charges", {
    method: "POST",
    body: JSON.stringify({
      amount_cents: Math.round(input.amount * 100),
      description: input.description,
      payer: {
        name: input.payerName,
        document: input.payerDocument,
      },
    }),
  });
}

export interface PayoutInput {
  amount: number;
  pixKey: string;
  beneficiaryName: string;
  description?: string;
}
export interface PayoutResult {
  externalId: string;
  status: "pendente" | "pago" | "falhou";
}

export async function createPayout(input: PayoutInput): Promise<PayoutResult> {
  if (!TOKEN) {
    return { externalId: `mock_out_${Date.now().toString(36)}`, status: "pago" };
  }
  const res = await call<{ id: string; status: string }>("/v1/payouts", {
    method: "POST",
    body: JSON.stringify({
      amount_cents: Math.round(input.amount * 100),
      pix_key: input.pixKey,
      beneficiary_name: input.beneficiaryName,
      description: input.description,
    }),
  });
  return {
    externalId: res.id,
    status: (res.status === "paid" ? "pago" : res.status === "failed" ? "falhou" : "pendente"),
  };
}

export async function getBalance(): Promise<{ available: number; pending: number }> {
  if (!TOKEN) {
    return { available: 12480.55, pending: 1300 };
  }
  const res = await call<{ available_cents: number; pending_cents: number }>("/v1/balance");
  return {
    available: res.available_cents / 100,
    pending: res.pending_cents / 100,
  };
}

export const isMock = !TOKEN;
