# Plano

## 1. Sincronização de status (depósitos e saques)
Hoje o status fica “pendente” mesmo depois de pago porque só gravamos o retorno inicial da EvoPay. Vou:
- Adicionar `atualizarStatusTransacao(id)` server fn que chama `GET /pix/{id}` ou `GET /withdraw/{id}` e atualiza o registro local (status, `paidAt`, `endToEndId`, etc.).
- Fazer polling automático a cada 8s nas telas de Depósitos/Saques enquanto houver itens `pendente` (via TanStack Query `refetchInterval`).
- Manter o webhook `/api/public/evopay.webhook` como fonte primária quando disponível.

## 2. Saldo — admin vs. funcionário
Confirmando: **saldo do gateway EvoPay é visível apenas para admin**. Vou:
- Bloquear `consultarSaldo` para `role !== "admin"` (retorna 403).
- Esconder o card “Saldo EvoPay” do dashboard para funcionários.
- Criar `meuSaldo()` para funcionários: soma dos `pagamento_funcionario` com status `pago` menos o que já foi sacado por ele (histórico próprio). Exibir no `/app/meus-recebimentos`.

> Obs.: EvoPay tem uma única carteira por token; não há sub-contas nativas. O saldo por funcionário é calculado internamente a partir do histórico.

## 3. Detalhes / comprovante da transação
- Adicionar botão “Ver” em cada linha das tabelas (Depósitos, Saques, Histórico).
- Abrir modal `TransactionDetailDialog` com: ID interno, ID EvoPay, status atual (com botão “Atualizar”), valor, descrição, chave/pagador, criado em, pago em, `endToEndId`, e para depósito o QR + copia‑e‑cola.
- Botão “Baixar comprovante” gera PNG simples via `html-to-image` (client) do próprio modal.

## 4. Saque por QR Pix (copia‑e‑cola + câmera)
Segundo a doc, `POST /withdraw/` aceita chave Pix. Para pagar um QR (BR Code) vamos:
- Decodificar o payload EMV no cliente para extrair a chave Pix (campo 26 → subcampo 01) e o valor sugerido (campo 54) usando um parser leve próprio (sem dependência nativa).
- Preencher automaticamente `pixKey`, `keyType` e `amount` no formulário de saque; usuário confirma e envia via o mesmo endpoint `/withdraw/`.
- Adicionar toggle no topo do formulário: **Chave manual** | **QR / Copia‑e‑cola**.
- No modo QR:
  - Textarea para colar o BR Code → botão “Ler”.
  - Botão “Escanear com a câmera” usando `@zxing/browser` (WebAssembly, funciona no mobile) abrindo `<video>` in‑modal.

> A doc EvoPay não expõe um endpoint dedicado “pagar QR”; o fluxo padrão é extrair a chave do BR Code e usar `/withdraw/`. Se você tiver acesso a um endpoint específico (ex: `/pix/pay-qr`), me diga que eu troco.

## 5. Detalhes técnicos
- Novas deps: `@zxing/browser` (scanner). Parser EMV escrito à mão (~40 linhas).
- Novos arquivos: `src/lib/pix-emv.ts`, `src/components/qr-scanner.tsx`, `src/components/transaction-detail-dialog.tsx`.
- Atualizações: `evopay.server.ts` (+ `getPixStatus`, `getWithdrawStatus`), `evopay.functions.ts` (+ `atualizarStatus`, guard admin no saldo), `app.depositos.tsx`, `app.saques.tsx`, `app.historico.tsx`, `app.index.tsx`, `app.meus-recebimentos.tsx`.

Confirma que posso seguir com tudo isso?
