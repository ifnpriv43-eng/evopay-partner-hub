import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { criarSaque, criarSaqueQr, decodificarQr } from "@/lib/evopay.functions";
import { listarTransacoes } from "@/lib/transactions.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge, brl } from "@/components/tx-helpers";
import { TransactionDetailDialog } from "@/components/transaction-detail-dialog";
import { QrScanner } from "@/components/qr-scanner";
import { parsePixBrCode } from "@/lib/pix-emv";
import { Loader2, ArrowUpFromLine, Camera, Eye, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Transaction } from "@/server/db/schema";

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
  const [brCode, setBrCode] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [merchant, setMerchant] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["txs", "saque"],
    queryFn: () => listarTransacoes({ data: { kind: "saque", limit: 100 } }),
    refetchInterval: (q) => (q.state.data?.some((t) => t.status === "pendente") ? 8000 : false),
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
      setAmount(""); setPixKey(""); setDesc(""); setBrCode(""); setMerchant(null);
      qc.invalidateQueries({ queryKey: ["txs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["saldo"] });
      toast.success("Saque solicitado");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function processBrCode(text: string) {
    const parsed = parsePixBrCode(text);
    if (!parsed || !parsed.pixKey) {
      toast.error("QR Pix inválido — não consegui extrair a chave");
      return;
    }
    setPixKey(parsed.pixKey);
    if (parsed.keyType) setKeyType(parsed.keyType);
    if (parsed.amount) setAmount(String(parsed.amount));
    if (parsed.description) setDesc(parsed.description);
    setMerchant(parsed.merchantName ?? null);
    setBrCode(text);
    toast.success("QR lido — confira e envie");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Saques</h1>
        <p className="text-muted-foreground text-sm mt-1">Envie Pix por chave ou pagando um QR.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <Card className="p-6 h-fit">
          <h2 className="font-semibold flex items-center gap-2"><ArrowUpFromLine className="h-4 w-4 text-primary" /> Novo saque</h2>

          <Tabs defaultValue="chave" className="mt-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="chave">Chave</TabsTrigger>
              <TabsTrigger value="qr">QR / Copia‑cola</TabsTrigger>
            </TabsList>

            <TabsContent value="chave" className="mt-4 space-y-4">
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
            </TabsContent>

            <TabsContent value="qr" className="mt-4 space-y-3">
              <Textarea
                value={brCode}
                onChange={(e) => setBrCode(e.target.value)}
                placeholder="Cole aqui o código Pix copia‑e‑cola…"
                className="min-h-[100px] font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => processBrCode(brCode)} disabled={!brCode.trim()}>
                  <ScanLine className="h-4 w-4 mr-1" /> Ler código
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setScanOpen(true)}>
                  <Camera className="h-4 w-4 mr-1" /> Câmera
                </Button>
              </div>
              {pixKey && (
                <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                  {merchant && <div><span className="text-muted-foreground">Recebedor:</span> {merchant}</div>}
                  <div className="font-mono break-all"><span className="text-muted-foreground">Chave:</span> {pixKey}</div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <Button type="submit" disabled={create.isPending || !pixKey} className="w-full gradient-primary text-primary-foreground">
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
                  <th className="text-left py-3 px-4 font-medium">Data</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-4 font-medium">Valor</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(list.data ?? []).map((t) => (
                  <tr key={t.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4 text-muted-foreground text-xs break-all">{t.pixKey}</td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{new Date(t.createdAt).toLocaleString("pt-BR")}</td>
                    <td className="py-3 px-4"><StatusBadge status={t.status} /></td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">−{brl(t.amount)}</td>
                    <td className="py-3 px-4 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(t)}>
                        <Eye className="h-4 w-4 mr-1" /> Ver
                      </Button>
                    </td>
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

      <QrScanner open={scanOpen} onOpenChange={setScanOpen} onDecoded={processBrCode} />
      <TransactionDetailDialog tx={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}
