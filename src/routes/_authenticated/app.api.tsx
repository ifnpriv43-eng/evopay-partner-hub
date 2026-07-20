import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { criarToken, listarTokens, revogarToken } from "@/lib/api-tokens.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Code2, Copy, Key, Loader2, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/api")({
  component: ApiPage,
});

function ApiPage() {
  const qc = useQueryClient();
  const tokens = useQuery({ queryKey: ["api-tokens"], queryFn: () => listarTokens() });
  const [openNew, setOpenNew] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const baseUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/v1` : "https://seu-dominio/api/public/v1";
  const activeToken = tokens.data?.find((t) => t.active);
  const exampleToken = newToken ?? (activeToken ? `pk_live_••••••••${activeToken.last4}` : "SEU_TOKEN_AQUI");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Code2 className="h-7 w-7 text-primary" /> Minha API</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Integre seu sistema à sua conta. Pagamentos gerados via API caem direto no seu saldo.
        </p>
      </div>

      <Card className="p-6 border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong>Como funciona:</strong> cada depósito Pix gerado com seu token é registrado no seu saldo pessoal.
            Quando o cliente paga, o valor entra automaticamente e fica disponível pra sacar tanto pelo dashboard quanto pela API.
            Toda a comunicação com o gateway acontece por trás — você só precisa do seu token.
          </div>
        </div>
      </Card>

      {/* Tokens */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><Key className="h-4 w-4 text-primary" /> Meus tokens</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Use no header <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization: Bearer pk_live_…</code></p>
          </div>
          <Button onClick={() => setOpenNew(true)} className="gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> Novo token
          </Button>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left py-2 px-3 font-medium">Nome</th>
                <th className="text-left py-2 px-3 font-medium">Token</th>
                <th className="text-left py-2 px-3 font-medium">Criado</th>
                <th className="text-left py-2 px-3 font-medium">Último uso</th>
                <th className="text-center py-2 px-3 font-medium">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(tokens.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td className="py-2 px-3 font-medium">{t.name}</td>
                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground">pk_live_••••{t.last4}</td>
                  <td className="py-2 px-3 text-muted-foreground text-xs whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td className="py-2 px-3 text-muted-foreground text-xs whitespace-nowrap">{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString("pt-BR") : "—"}</td>
                  <td className="py-2 px-3 text-center">
                    {t.active
                      ? <Badge variant="outline" className="text-primary border-primary/30">ativo</Badge>
                      : <Badge variant="secondary">revogado</Badge>}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {t.active && <RevokeBtn id={t.id} name={t.name} />}
                  </td>
                </tr>
              ))}
              {(!tokens.data || tokens.data.length === 0) && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhum token ainda. Crie o primeiro pra começar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Documentação */}
      <Card className="p-6">
        <h2 className="font-semibold mb-1">Documentação</h2>
        <p className="text-sm text-muted-foreground mb-4">
          URL base: <code className="text-xs bg-muted px-1 py-0.5 rounded">{baseUrl}</code>
        </p>

        <div className="space-y-6">
          <EndpointDoc
            method="GET" path="/balance" title="Consultar saldo"
            description="Retorna o saldo interno do dono do token."
            curl={`curl ${baseUrl}/balance \\\n  -H "Authorization: Bearer ${exampleToken}"`}
            js={`const res = await fetch("${baseUrl}/balance", {\n  headers: { Authorization: "Bearer ${exampleToken}" }\n});\nconst { recebido, sacado, disponivel } = await res.json();`}
            response={`{\n  "recebido": 1250.00,\n  "sacado": 300.00,\n  "disponivel": 950.00\n}`}
          />

          <EndpointDoc
            method="POST" path="/pix" title="Gerar cobrança Pix"
            description="Cria um Pix. O valor pago cai no seu saldo interno."
            curl={`curl -X POST ${baseUrl}/pix \\\n  -H "Authorization: Bearer ${exampleToken}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"amount": 10.00, "description": "Pedido #123"}'`}
            js={`const res = await fetch("${baseUrl}/pix", {\n  method: "POST",\n  headers: {\n    Authorization: "Bearer ${exampleToken}",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    amount: 10.00,\n    description: "Pedido #123",\n    payerName: "João",       // opcional\n    payerDocument: "12345678900" // opcional\n  })\n});\nconst { id, qrCode, qrImage, status } = await res.json();`}
            response={`{\n  "id": "tx_...",\n  "kind": "deposito",\n  "status": "pendente",\n  "amount": 10.00,\n  "qrCode": "00020126580014BR.GOV.BCB.PIX...",\n  "qrImage": "data:image/png;base64,...",\n  "createdAt": "2026-07-20T..."\n}`}
          />

          <EndpointDoc
            method="GET" path="/pix/{id}" title="Status de um Pix"
            description="Consulta o status atual — sincroniza com o gateway automaticamente."
            curl={`curl ${baseUrl}/pix/tx_abc123 \\\n  -H "Authorization: Bearer ${exampleToken}"`}
            js={`const res = await fetch(\`${baseUrl}/pix/\${id}\`, {\n  headers: { Authorization: "Bearer ${exampleToken}" }\n});\nconst tx = await res.json();`}
            response={`{\n  "id": "tx_...",\n  "status": "pago",\n  "amount": 10.00,\n  "paidAt": "2026-07-20T..."\n}`}
          />

          <EndpointDoc
            method="POST" path="/withdraw" title="Sacar pra chave Pix"
            description="Envia Pix pra chave. Precisa ter saldo disponível."
            curl={`curl -X POST ${baseUrl}/withdraw \\\n  -H "Authorization: Bearer ${exampleToken}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"amount": 50, "pixKey": "email@ex.com", "keyType": "email"}'`}
            js={`const res = await fetch("${baseUrl}/withdraw", {\n  method: "POST",\n  headers: {\n    Authorization: "Bearer ${exampleToken}",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    amount: 50,\n    pixKey: "email@exemplo.com",\n    keyType: "email", // cpf | cnpj | email | telefone | aleatoria\n    description: "Saque"\n  })\n});`}
            response={`{\n  "id": "tx_...",\n  "kind": "saque",\n  "status": "pendente",\n  "amount": 50.00\n}`}
          />

          <EndpointDoc
            method="POST" path="/withdraw/qrcode" title="Sacar pagando QR Pix"
            description="Paga um copia-e-cola / QR Pix (estático ou dinâmico)."
            curl={`curl -X POST ${baseUrl}/withdraw/qrcode \\\n  -H "Authorization: Bearer ${exampleToken}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"qrCode": "00020126..."}'`}
            js={`const res = await fetch("${baseUrl}/withdraw/qrcode", {\n  method: "POST",\n  headers: {\n    Authorization: "Bearer ${exampleToken}",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    qrCode: "00020126...",\n    amount: 25 // obrigatório só se o QR for estático sem valor\n  })\n});`}
            response={`{\n  "id": "tx_...",\n  "status": "pendente",\n  "amount": 25.00\n}`}
          />

          <EndpointDoc
            method="GET" path="/withdraw/{id}" title="Status de um saque"
            description="Sincroniza com o gateway."
            curl={`curl ${baseUrl}/withdraw/tx_abc \\\n  -H "Authorization: Bearer ${exampleToken}"`}
            js={`const res = await fetch(\`${baseUrl}/withdraw/\${id}\`, {\n  headers: { Authorization: "Bearer ${exampleToken}" }\n});`}
            response={`{\n  "id": "tx_...",\n  "status": "pago",\n  "paidAt": "2026-07-20T..."\n}`}
          />

          <EndpointDoc
            method="GET" path="/transactions?limit=50" title="Listar transações"
            description="Últimas movimentações do dono do token."
            curl={`curl "${baseUrl}/transactions?limit=20" \\\n  -H "Authorization: Bearer ${exampleToken}"`}
            js={`const res = await fetch("${baseUrl}/transactions?limit=20", {\n  headers: { Authorization: "Bearer ${exampleToken}" }\n});\nconst { data, total } = await res.json();`}
            response={`{\n  "data": [ { "id": "...", "kind": "deposito", "status": "pago", ... } ],\n  "total": 42\n}`}
          />
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="font-semibold text-sm mb-2">Códigos de erro</h3>
          <ul className="text-xs text-muted-foreground space-y-1 font-mono">
            <li><span className="text-destructive">401</span> unauthorized — token ausente, inválido ou revogado</li>
            <li><span className="text-destructive">400</span> invalid_input / invalid_json — body malformado</li>
            <li><span className="text-destructive">402</span> insufficient_balance — saldo insuficiente pro saque</li>
            <li><span className="text-destructive">404</span> not_found — id não encontrado ou de outro dono</li>
            <li><span className="text-destructive">502</span> gateway_error — falha na comunicação com o Pix</li>
          </ul>
        </div>
      </Card>

      <NewTokenDialog
        open={openNew}
        onOpenChange={(o) => { setOpenNew(o); if (!o) setNewToken(null); }}
        onCreated={(raw) => { setNewToken(raw); qc.invalidateQueries({ queryKey: ["api-tokens"] }); }}
        rawToken={newToken}
      />
    </div>
  );
}

function EndpointDoc({ method, path, title, description, curl, js, response }: {
  method: "GET" | "POST"; path: string; title: string; description: string;
  curl: string; js: string; response: string;
}) {
  const methodColor = method === "GET" ? "bg-blue-500/15 text-blue-400" : "bg-primary/15 text-primary";
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${methodColor}`}>{method}</span>
          <code className="text-sm font-mono">{path}</code>
          <span className="ml-2 text-sm font-medium">{title}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <Tabs defaultValue="curl" className="p-4">
        <TabsList className="mb-3">
          <TabsTrigger value="curl">cURL</TabsTrigger>
          <TabsTrigger value="js">JavaScript</TabsTrigger>
          <TabsTrigger value="response">Resposta</TabsTrigger>
        </TabsList>
        <TabsContent value="curl"><CodeBlock code={curl} /></TabsContent>
        <TabsContent value="js"><CodeBlock code={js} /></TabsContent>
        <TabsContent value="response"><CodeBlock code={response} /></TabsContent>
      </Tabs>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="bg-muted/40 rounded-lg p-3 pr-10 overflow-x-auto text-xs font-mono whitespace-pre">{code}</pre>
      <Button
        size="icon" variant="ghost"
        className="absolute top-2 right-2 h-7 w-7 opacity-60 hover:opacity-100"
        onClick={() => { navigator.clipboard.writeText(code); toast.success("Copiado"); }}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function RevokeBtn({ id, name }: { id: string; name: string }) {
  const qc = useQueryClient();
  const rev = useMutation({
    mutationFn: () => revogarToken({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-tokens"] }); toast.success(`${name} revogado`); },
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revogar {name}?</AlertDialogTitle>
          <AlertDialogDescription>O token para de funcionar imediatamente. Essa ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => rev.mutate()}>Revogar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NewTokenDialog({ open, onOpenChange, onCreated, rawToken }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onCreated: (raw: string) => void; rawToken: string | null;
}) {
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => criarToken({ data: { name: name.trim() } }),
    onSuccess: (r) => { onCreated(r.token); setName(""); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {rawToken ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Token criado</DialogTitle>
              <DialogDescription>Copie e guarde agora. Por segurança não conseguimos mostrar de novo.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/40 p-3 font-mono text-xs break-all">{rawToken}</div>
              <Button
                className="w-full gradient-primary text-primary-foreground"
                onClick={() => { navigator.clipboard.writeText(rawToken); toast.success("Copiado"); }}
              >
                <Copy className="h-4 w-4 mr-2" /> Copiar token
              </Button>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>Trate como senha. Nunca exponha em código do front-end nem em repositórios públicos.</span>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Já guardei</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader><DialogTitle>Criar novo token</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome (pra identificar)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Produção, Servidor node, Loja X" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !name.trim()} className="gradient-primary text-primary-foreground">
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
