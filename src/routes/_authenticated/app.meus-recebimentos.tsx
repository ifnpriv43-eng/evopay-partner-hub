import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listarTransacoes } from "@/lib/transactions.functions";
import { meuSaldoFuncionario } from "@/lib/evopay.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, brl } from "@/components/tx-helpers";
import { TransactionDetailDialog } from "@/components/transaction-detail-dialog";
import { Wallet, TrendingUp, Clock, Eye } from "lucide-react";
import type { Transaction } from "@/server/db/schema";

export const Route = createFileRoute("/_authenticated/app/meus-recebimentos")({
  component: MeusRecebimentosPage,
});

function MeusRecebimentosPage() {
  const { user } = Route.useRouteContext();
  const [detail, setDetail] = useState<Transaction | null>(null);
  const list = useQuery({ queryKey: ["my-txs"], queryFn: () => listarTransacoes({ data: {} }) });
  const saldo = useQuery({ queryKey: ["meu-saldo"], queryFn: () => meuSaldoFuncionario() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Olá, {user.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">Seus recebimentos e histórico de pagamentos.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5 border-primary/30 bg-primary/5">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-2"><Wallet className="h-3.5 w-3.5" /> Meu saldo recebido</div>
          <div className="mt-3 text-2xl font-bold text-gradient font-display">{brl(saldo.data?.recebido ?? 0)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> A receber</div>
          <div className="mt-3 text-2xl font-bold font-display">{brl(saldo.data?.pendente ?? 0)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5" /> Valor da diária</div>
          <div className="mt-3 text-2xl font-bold font-display">{brl(user.dailyAmount ?? 0)}</div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Extrato</h2>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Data</th>
                <th className="text-left py-3 px-4 font-medium">Descrição</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-right py-3 px-4 font-medium">Valor</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(list.data ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-muted/20">
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{new Date(t.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="py-3 px-4 font-medium">{t.description}</td>
                  <td className="py-3 px-4"><StatusBadge status={t.status} /></td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-success">+{brl(t.amount)}</td>
                  <td className="py-3 px-4 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(t)}>
                      <Eye className="h-4 w-4 mr-1" /> Ver
                    </Button>
                  </td>
                </tr>
              ))}
              {(!list.data || list.data.length === 0) && (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-8">Nenhum recebimento ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <TransactionDetailDialog tx={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}
