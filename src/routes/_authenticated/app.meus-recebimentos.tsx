import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listarTransacoes } from "@/lib/transactions.functions";
import { meuSaldoFuncionario, sacarMeuSaldo } from "@/lib/evopay.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, brl } from "@/components/tx-helpers";
import { TransactionDetailDialog } from "@/components/transaction-detail-dialog";
import { Wallet, TrendingUp, Clock, Eye, ArrowUpFromLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Transaction } from "@/server/db/schema";

export const Route = createFileRoute("/_authenticated/app/meus-recebimentos")({
  component: MeusRecebimentosPage,
});

type KeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
const keyPlaceholders: Record<KeyType, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  email: "nome@exemplo.com",
  telefone: "+55 11 99999-9999",
  aleatoria: "chave-aleatoria-uuid",
};

function MeusRecebimentosPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [detail, setDetail] = useState<Transaction | null>(null);
  const list = useQuery({
    queryKey: ["my-txs"],
    queryFn: () => listarTransacoes({ data: {} }),
    refetchInterval: (q) => (q.state.data?.some((t) => t.status === "pendente") ? 8000 : false),
  });
  const saldo = useQuery({ queryKey: ["meu-saldo"], queryFn: () => meuSaldoFuncionario() });

  const [amount, setAmount] = useState("");
  const [keyType, setKeyType] = useState<KeyType>("aleatoria");
  const [pixKey, setPixKey] = useState("");

  const sacar = useMutation({
    mutationFn: () => sacarMeuSaldo({
      data: { amount: parseFloat(amount), pixKey, keyType, description: "Saque solicitado" },
    }),
    onSuccess: () => {
      setAmount(""); setPixKey("");
      qc.invalidateQueries();
      toast.success("Saque solicitado");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const disponivel = saldo.data?.disponivel ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Olá, {user.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">Seus recebimentos, saldo e saques.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5 border-primary/30 bg-primary/5">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-2"><Wallet className="h-3.5 w-3.5" /> Disponível pra sacar</div>
          <div className="mt-3 text-2xl font-bold text-gradient font-display">{brl(disponivel)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5" /> Recebido total</div>
          <div className="mt-3 text-2xl font-bold font-display">{brl(saldo.data?.recebido ?? 0)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> A receber</div>
          <div className="mt-3 text-2xl font-bold font-display">{brl(saldo.data?.pendente ?? 0)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-2"><ArrowUpFromLine className="h-3.5 w-3.5" /> Já sacado</div>
          <div className="mt-3 text-2xl font-bold font-display">{brl(saldo.data?.sacado ?? 0)}</div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <Card className="p-6 h-fit">
          <h2 className="font-semibold flex items-center gap-2"><ArrowUpFromLine className="h-4 w-4 text-primary" /> Sacar meu saldo</h2>
          <p className="text-xs text-muted-foreground mt-1">Escolha a chave Pix pra onde o valor vai.</p>
          <form onSubmit={(e) => { e.preventDefault(); sacar.mutate(); }} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Tipo de chave</Label>
              <Select value={keyType} onValueChange={(v) => setKeyType(v as KeyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatoria">Chave aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chave Pix</Label>
              <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder={keyPlaceholders[keyType]} />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0.01" max={disponivel} required value={amount} onChange={(e) => setAmount(e.target.value)} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Disponível: {brl(disponivel)}</span>
                <button type="button" className="text-primary hover:underline" onClick={() => setAmount(String(disponivel))}>Usar tudo</button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={sacar.isPending || !pixKey || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > disponivel}
              className="w-full gradient-primary text-primary-foreground"
            >
              {sacar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Pix"}
            </Button>
          </form>
        </Card>

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
                {(list.data ?? []).map((t) => {
                  const negativo = t.kind === "saque";
                  return (
                    <tr key={t.id} className="hover:bg-muted/20">
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{new Date(t.createdAt).toLocaleString("pt-BR")}</td>
                      <td className="py-3 px-4 font-medium">{t.description}</td>
                      <td className="py-3 px-4"><StatusBadge status={t.status} /></td>
                      <td className={`py-3 px-4 text-right font-mono font-semibold ${negativo ? "text-destructive" : "text-success"}`}>
                        {negativo ? "−" : "+"}{brl(t.amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(t)}>
                          <Eye className="h-4 w-4 mr-1" /> Ver
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {(!list.data || list.data.length === 0) && (
                  <tr><td colSpan={5} className="text-center text-muted-foreground py-8">Nenhum movimento ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <TransactionDetailDialog tx={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}
