import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { criarSaque } from "@/lib/evopay.functions";
import { listarTransacoes } from "@/lib/transactions.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, brl } from "@/components/tx-helpers";
import { Loader2, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/saques")({
  component: SaquesPage,
});

type KeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

const keyPlaceholders: Record<KeyType, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  email: "nome@exemplo.com",
  telefone: "+55 11 99999-9999",
  aleatoria: "chave-aleatoria-uuid",
};

function SaquesPage() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [keyType, setKeyType] = useState<KeyType>("aleatoria");
  const [pixKey, setPixKey] = useState("");
  const [desc, setDesc] = useState("");

  const list = useQuery({
    queryKey: ["txs", "saque"],
    queryFn: () => listarTransacoes({ data: { kind: "saque", limit: 100 } }),
  });

  const create = useMutation({
    mutationFn: () => criarSaque({
      data: {
        amount: parseFloat(amount),
        pixKey,
        keyType,
        beneficiaryName: "—",
        description: desc || undefined,
      },
    }),
    onSuccess: () => {
      setAmount(""); setPixKey(""); setDesc("");
      qc.invalidateQueries({ queryKey: ["txs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["saldo"] });
      toast.success("Saque solicitado");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Saques</h1>
        <p className="text-muted-foreground text-sm mt-1">Envie Pix para qualquer chave.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <Card className="p-6 h-fit">
          <h2 className="font-semibold flex items-center gap-2"><ArrowUpFromLine className="h-4 w-4 text-primary" /> Novo saque</h2>
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
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
              <Input required value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder={keyPlaceholders[keyType]} />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <Button type="submit" disabled={create.isPending} className="w-full gradient-primary text-primary-foreground">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Pix"}
            </Button>
          </form>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold">Últimos saques</h2>
          </div>
          <div className="w-full overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Chave</th>
                <th className="text-left py-3 px-4 font-medium">Tipo</th>
                <th className="text-left py-3 px-4 font-medium">Data</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-right py-3 px-4 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(list.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{t.pixKey}</td>
                  <td className="py-3 px-4 text-muted-foreground capitalize">{t.counterparty && t.counterparty !== "—" ? t.counterparty : "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{new Date(t.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="py-3 px-4"><StatusBadge status={t.status} /></td>
                  <td className="py-3 px-4 text-right font-mono font-semibold">−{brl(t.amount)}</td>
                </tr>
              ))}
              {(!list.data || list.data.length === 0) && (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-8">Nenhum saque ainda.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
