import { db } from "@/server/db";
import { createPayout } from "@/server/evopay.server";

export async function executarPagamentoDiario(): Promise<{
  total: number;
  results: Array<{ employeeId: string; ok: boolean; error?: string }>;
}> {
  const emps = (await db.listEmployees()).filter(
    (e) => e.role === "funcionario" && e.active && e.dailyAmount && e.pixKey,
  );
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
}

let started = false;

export function startAutoPayScheduler() {
  if (started) return;
  if (typeof setInterval !== "function") return;
  started = true;
  console.log("[autopay] scheduler ativo (checa a cada 30s)");
  setInterval(async () => {
    try {
      const cfg = await db.getAutoPay();
      if (!cfg.enabled) return;
      // Horário de Brasília (America/Sao_Paulo, UTC-3, sem horário de verão desde 2019)
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).formatToParts(new Date());
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      const hour = parseInt(get("hour"), 10);
      const minute = parseInt(get("minute"), 10);
      const today = `${get("year")}-${get("month")}-${get("day")}`;
      if (hour !== cfg.hour || minute !== cfg.minute) return;
      if (cfg.lastRunAt && cfg.lastRunAt.slice(0, 10) === today) return;
      console.log(`[autopay] disparando pagamentos ${cfg.hour}:${cfg.minute} (BRT)`);
      const r = await executarPagamentoDiario();
      console.log(`[autopay] ok=${r.results.filter((x) => x.ok).length}/${r.total}`);
    } catch (e) {
      console.error("[autopay] erro:", e);
    }
  }, 30_000);
}
