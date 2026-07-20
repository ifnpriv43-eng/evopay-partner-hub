# Dashboard EvoPay Gateway

## Visão geral

Painel administrativo completo integrado à EvoPay para gerenciar depósitos Pix, saques, histórico de transações e pagamentos recorrentes a funcionários. Login com dois papéis (admin/funcionário). Deploy alvo: VPS próprio com Node.js + SQLite.

## Design

Baseado em updepix.com: tema **dark**, verde neon (#00E676 / verde-limão) como cor de destaque, cards com bordas sutis, tipografia sans-serif moderna (Inter/Space Grotesk), muitos gráficos e badges de status, sensação "fintech pro". Sidebar fixa à esquerda com ícones + labels.

## Escopo funcional

### 1. Autenticação
- Página `/login` — email + senha
- Papéis: **admin** (vê tudo, gerencia funcionários e paga) e **funcionario** (vê apenas o próprio painel de recebimentos)
- Sessão com cookie httpOnly assinado
- Rota `/logout`

### 2. Dashboard admin (`/app`)
- Cards: saldo EvoPay, total recebido no dia, total sacado no mês, transações pendentes
- Gráfico de linha: receita últimos 30 dias
- Lista das 10 últimas transações

### 3. Depósitos (`/app/depositos`)
- Botão "Gerar Pix" → modal com valor, nome/CPF do pagador
- Cria cobrança via EvoPay API, exibe **QR Code + copia-cola**
- Lista de depósitos com status (pendente / pago / expirado), filtros por data
- Webhook `/api/public/evopay/webhook` atualiza status automaticamente

### 4. Saques (`/app/saques`)
- Formulário: valor, chave Pix, nome do beneficiário
- Confirmação com senha antes de disparar
- Chama endpoint de payout da EvoPay
- Lista de saques com status

### 5. Histórico (`/app/historico`)
- Tabela unificada (depósitos + saques + pagamentos a funcionários)
- Filtros: tipo, status, período, busca por nome/valor
- Exportar CSV

### 6. Suporte / Funcionários (`/app/funcionarios`)
- CRUD de funcionários: nome, chave Pix, valor diário, ativo/inativo
- Botão **"Pagar todos hoje"** (manual, 1 clique — pede confirmação)
- Toggle "Pagamento automático diário" com hora configurável
- Cron interno roda todo dia no horário definido e paga funcionários ativos
- Cada funcionário tem seu próprio login e vê apenas `/app/meus-recebimentos`

### 7. Painel do funcionário (`/app/meus-recebimentos`)
- Extrato dos pagamentos recebidos
- Total do mês, próximo pagamento previsto

## Arquitetura técnica

### Stack
- **Frontend/Backend:** TanStack Start (React 19 + SSR + server functions)
- **Banco:** SQLite (`better-sqlite3`) em produção; adapter JSON em memória no preview Lovable
- **Auth:** sessão cookie httpOnly + bcrypt pra senhas
- **Cron:** `node-cron` (roda dentro do processo Node no VPS)
- **UI:** Tailwind CSS + shadcn/ui + Recharts + lucide-react
- **EvoPay:** cliente HTTP server-side; token guardado em `process.env.EVOPAY_TOKEN`

### Camada de dados
```
src/server/db/
  ├── index.ts           # escolhe adapter baseado em DATA_DRIVER
  ├── schema.ts          # tipos User, Transaction, Employee, Payment
  ├── sqlite.ts          # adapter SQLite (VPS)
  └── memory.ts          # adapter em memória (preview Lovable)
```
`process.env.DATA_DRIVER = "sqlite" | "memory"` (default memory)

### Estrutura de rotas
```
src/routes/
  ├── index.tsx                       # landing / redireciona pra /login
  ├── login.tsx
  ├── _authenticated/
  │   ├── route.tsx                   # gate de auth
  │   ├── app.tsx                     # layout com sidebar
  │   ├── app.index.tsx               # dashboard
  │   ├── app.depositos.tsx
  │   ├── app.saques.tsx
  │   ├── app.historico.tsx
  │   ├── app.funcionarios.tsx        # só admin
  │   └── app.meus-recebimentos.tsx   # só funcionário
  └── api/
      └── public/
          └── evopay.webhook.ts       # recebe callbacks da EvoPay
```

### Server functions
```
src/lib/
  ├── auth.functions.ts       # login, logout, me
  ├── evopay.functions.ts     # criarPix, sacar, consultarSaldo
  ├── employees.functions.ts  # CRUD + pagarTodos
  └── transactions.functions.ts
src/server/
  ├── evopay.server.ts        # wrapper HTTP da API EvoPay
  ├── auth.server.ts          # bcrypt, sessão
  └── cron.server.ts          # agendamentos
```

## Deploy no VPS (guia que entrego junto)

1. `git clone` + `bun install`
2. `.env` com: `EVOPAY_TOKEN`, `SESSION_SECRET`, `DATA_DRIVER=sqlite`, `SQLITE_PATH=./data/app.db`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
3. `bun run build`
4. `pm2 start .output/server/index.mjs --name evopay-dashboard`
5. Nginx reverse proxy porta 80/443 → 3000 + Certbot pra SSL
6. Configurar webhook na EvoPay: `https://seudominio.com/api/public/evopay/webhook`

## Ordem de implementação

1. Design system dark verde-neon + landing/login
2. Camada de dados (schema + adapters memory/sqlite)
3. Auth (funcs, gate, sessão)
4. Layout autenticado + sidebar + dashboard vazio
5. Wrapper EvoPay + depósitos (com QR)
6. Saques
7. Histórico
8. Funcionários + cron + painel do funcionário
9. Webhook EvoPay
10. Guia de deploy VPS (`DEPLOY.md`)

## O que fica pra depois

- Token EvoPay real: você adiciona via secret depois que eu terminar a estrutura (mockado por enquanto pra você ver funcionando no preview)
- Migração pra MySQL (você pediu que fica pra depois)
- 2FA no login
- Rate limiting nos webhooks
