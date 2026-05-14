# MAIA — Documentação Técnica

> Sistema single-tenant de saúde ocupacional da **ENGEKO**, distribuído em dois repositórios (`maia-db` para o backend Supabase, `maia-app` para o frontend Next.js). Esta documentação cobre o sistema como um todo.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Stack técnica](#3-stack-técnica)
4. [Estrutura dos repositórios](#4-estrutura-dos-repositórios)
5. [Modelo de dados](#5-modelo-de-dados)
6. [Autenticação e autorização](#6-autenticação-e-autorização)
7. [Fluxos principais](#7-fluxos-principais)
8. [Integrações externas](#8-integrações-externas)
9. [Rotas e endpoints](#9-rotas-e-endpoints)
10. [Sistema de e-mails](#10-sistema-de-e-mails)
11. [Auditoria (eventos)](#11-auditoria-eventos)
12. [Design system](#12-design-system)
13. [Testes](#13-testes)
14. [Variáveis de ambiente](#14-variáveis-de-ambiente)
15. [Deploy](#15-deploy)
16. [Convenções](#16-convenções)
17. [Backlog e oportunidades de melhoria](#17-backlog-e-oportunidades-de-melhoria)

---

## 1. Visão geral

A **MAIA** é o sistema interno da ENGEKO para gestão de **afastamentos de colaboradores** e **ocorrências de segurança do trabalho**. Foi reconstruída do zero como um produto single-tenant — uma única empresa-cliente — substituindo a versão anterior multi-tenant.

### Objetivos do produto

- **Coletar** afastamentos via formulário público (sem necessidade de login do colaborador).
- **Aprovar** afastamentos médicos por uma equipe interna de Saúde Ocupacional (SO/OH).
- **Empurrar** afastamentos aprovados para o Fluig (TOTVS), o ERP de RH/Folha da ENGEKO.
- **Notificar** colaboradores, gestores e a folha de pagamento por e-mail.
- **Permitir resubmissão** quando um afastamento for rejeitado (via token público estável).
- **Registrar ocorrências** de segurança (a investigação completa fica deferida para uma fase posterior).

### Decisões de design importantes

- **Single-tenant**: sem subdomínio por empresa, sem `org_id` em nenhuma tabela. A ENGEKO é a única empresa-cliente.
- **Idioma do domínio**: tudo em **português do Brasil** — nomes de tabelas, colunas, rótulos, textos de UI, documentação.
- **State machine explícita**: o ciclo de vida do afastamento (`pendente → finalizado/rejeitado/cancelado`) é validado em código.
- **Trilha de auditoria unificada**: uma única tabela `eventos` registra qualquer mudança relevante em qualquer entidade.
- **Token de edição público estável**: links como Calendly/DocuSign permitem que o autor reenvie um registro rejeitado sem fazer login.

---

## 2. Arquitetura

### Diagrama em alto nível

```
                ┌──────────────────────────────────────────────────────┐
                │                  NAVEGADOR / USUÁRIO                 │
                └──────────────────────────────────────────────────────┘
                            │                          │
            (forms público) │            (login auth)  │
                            ▼                          ▼
   ┌────────────────────────────────────────────────────────────────┐
   │                         maia-app (Vercel)                       │
   │  Next.js 16 App Router • React 19 • Tailwind 4 • shadcn/ui      │
   │                                                                 │
   │  app/(public)        app/(auth)       app/(app)    app/(admin)  │
   │     │                   │                │              │       │
   │     │                   │                │              │       │
   │     ▼                   ▼                ▼              ▼       │
   │  Route Handlers (/api/*) ─── middleware.ts (gating auth) ───────│
   └─────┬───────────────────────────────────────────────────────────┘
         │                                       │
         │ (HTTPS, JWT)                          │ (service-role para
         ▼                                       │  operações privilegiadas)
   ┌─────────────────────────────────────────────▼─────────────────────┐
   │                       maia-db (Supabase Cloud)                    │
   │                                                                   │
   │   Postgres (RLS)        Storage (attachments)       Auth          │
   │   ├─ usuarios           └─ bucket privado           ├─ users      │
   │   ├─ equipes                                        └─ sessions   │
   │   ├─ empresas                                                     │
   │   ├─ unidades              Edge Functions (Deno)                  │
   │   ├─ afastamentos          ├─ soc-lookup (HTTP)                   │
   │   ├─ ocorrencias           └─ fluig-push (SOAP, 2 etapas)         │
   │   ├─ investigacoes                                                │
   │   └─ eventos                                                      │
   └────────┬───────────────────────────────────────────────┬──────────┘
            │                                               │
            │ (HTTP)                                        │ (SOAP)
            ▼                                               ▼
   ┌────────────────────┐                       ┌──────────────────────┐
   │     SOC (TOTVS)    │                       │   Fluig (TOTVS)      │
   │  Cadastro médico   │                       │   Workflow / Folha   │
   └────────────────────┘                       └──────────────────────┘

                    ┌──────────────────────────────────┐
                    │       Resend (e-mail SaaS)       │
                    │  Disparado a partir do maia-app  │
                    └──────────────────────────────────┘
```

### Responsabilidades por camada

| Camada                    | Onde fica                              | Responsabilidades                                                                   |
| ------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| UI                        | `maia-app/app/`, `components/`         | Páginas, formulários, listas, painel de aprovações                                  |
| API interna               | `maia-app/app/api/`                    | Route Handlers Next.js (autenticados e públicos)                                    |
| Lógica de domínio         | `maia-app/lib/`                        | State machine, permissões, validação Zod, helpers de eventos                        |
| Camada de dados           | `maia-db/supabase/migrations/`         | DDL, índices, triggers, políticas RLS, seeds                                        |
| Integrações Deno          | `maia-db/supabase/functions/`          | `soc-lookup` (cadastro SOC), `fluig-push` (workflow TOTVS via SOAP)                 |
| Auth                      | Supabase Auth                          | Usuários, sessões, JWT, SMTP customizado para invites                               |
| Armazenamento             | Supabase Storage (`attachments`)       | Anexos de afastamentos e ocorrências (uploads via service-role)                     |
| E-mail                    | Resend + templates HTML do `maia-app`  | E-mails transacionais (recibo, aprovação, rejeição, notificação à folha)            |

---

## 3. Stack técnica

### maia-app (frontend)

- **Next.js 16** (App Router, Server Components, Route Handlers)
- **React 19**
- **TypeScript** estrito
- **Tailwind CSS 4** (com `@theme inline` e tokens em `app/tokens.css`)
- **shadcn/ui** (única lib de componentes — primitivas Radix são instaladas sob demanda pelo `shadcn add`)
- **`@supabase/ssr`** + **`@supabase/supabase-js`** (clientes server, browser e admin)
- **Resend v6** (SDK Node para e-mail)
- **zod** + **react-hook-form** + **@hookform/resolvers** (validação)
- **sonner** (toasts), **lucide-react** (ícones), **clsx** + **tailwind-merge** + **class-variance-authority** (helpers shadcn)
- **date-fns** (datas)
- **Vitest** (unitário) + **Playwright** (E2E)

### maia-db (backend)

- **Supabase Postgres** (Postgres 15+) — extensão `pgcrypto` para `gen_random_uuid()`
- **Supabase CLI** + **Make** para deploy/reset/secrets
- **Deno** + edge runtime do Supabase (`jsr:@supabase/functions-js/edge-runtime.d.ts`)
- Sem framework adicional: edge functions são `Deno.serve(...)` puro

### Sem
- Sem React Email (templates são strings HTML com CSS inline)
- Sem Radix UI instalado diretamente (apenas via shadcn add)
- Sem pnpm/yarn/bun (apenas npm)
- Sem dotenv (Next.js carrega `.env.local` nativamente)
- Sem CI/CD configurado neste momento (deploy manual via Vercel + supabase CLI)

---

## 4. Estrutura dos repositórios

### Layout do filesystem

```
/Users/heizen/DEV/
├── old-maia/                ← legado, só para consulta enquanto a migração não está fechada
├── maia-db/                 ← migrações + edge functions
└── maia-app/                ← frontend Next.js
```

### maia-db

```
maia-db/
├── Makefile                                 # db-reset, db-push, functions-deploy, secrets
├── README.md                                # PT-BR
├── .env.example
└── supabase/
    ├── config.toml
    ├── seed.sql                             # placeholder (não usado; seeds vêm das migrations)
    ├── migrations/
    │   ├── 001_extensions.sql               # pgcrypto + set_atualizado_em()
    │   ├── 002_usuarios.sql
    │   ├── 003_equipes.sql                  # equipes + equipe_usuarios + seed oh/safety
    │   ├── 004_configuracoes.sql            # singleton (id = 1)
    │   ├── 005_empresas.sql
    │   ├── 006_unidades.sql
    │   ├── 007_afastamento_tipos.sql        # 12 tipos seedados
    │   ├── 008_afastamentos.sql             # core do domínio + 5 índices + trigger
    │   ├── 009_ocorrencias.sql
    │   ├── 010_investigacoes.sql
    │   ├── 011_eventos.sql                  # auditoria unificada
    │   ├── 012_storage.sql                  # bucket attachments
    │   ├── 013_rls.sql                      # is_admin/is_in_equipe + políticas SELECT
    │   └── 014_seed.sql                     # placeholders ENGEKO (substituir antes do prod)
    ├── tests/
    │   └── rls.sql                          # smoke psql para RLS
    └── functions/
        ├── _shared/
        │   ├── env.ts                       # requireEnv()
        │   ├── types.ts                     # mapTipoToFluigCode + FluigPushPayload
        │   ├── deno.json
        │   └── fluig-mapping.test.ts        # 4 testes Deno
        ├── soc-lookup/
        │   ├── index.ts                     # GET → POST: consulta CPF no SOC
        │   ├── deno.json
        │   └── test.ts                      # simbólico (mock fetch viria aqui)
        └── fluig-push/
            ├── index.ts                     # SOAP 2-etapas: createSimpleDocument + startProcess
            └── deno.json
```

### maia-app

```
maia-app/
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── components.json                          # shadcn
├── vitest.config.ts                         # alias @/ + exclude tests/e2e
├── playwright.config.ts
├── middleware.ts                            # refresh de sessão + gate de rotas autenticadas
├── .env.example                             # 8 chaves
├── docs/
│   └── DOCUMENTACAO.md                      # este arquivo
├── scripts/output/
│   ├── user-invite.html                     # gerar via emails/user-invite.ts
│   └── password-reset.html
├── app/
│   ├── layout.tsx                           # lang="pt-BR", Toaster sonner
│   ├── globals.css                          # imports tokens.css + Tailwind
│   ├── tokens.css                           # CSS variables (cor/espaço/tipografia)
│   ├── page.tsx                             # raiz
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── update-password/page.tsx
│   ├── auth/
│   │   ├── callback/route.ts                # PKCE exchange
│   │   └── confirm/route.ts                 # verify OTP token_hash
│   ├── (public)/
│   │   ├── forms/
│   │   │   ├── afastamentos/page.tsx
│   │   │   └── ocorrencias/page.tsx
│   │   └── afastamentos/editar/[token]/page.tsx
│   ├── (app)/                               # gate: usuário autenticado
│   │   ├── layout.tsx                       # + TopNav
│   │   ├── painel/page.tsx
│   │   ├── afastamentos/
│   │   │   ├── page.tsx                     # lista
│   │   │   ├── [id]/page.tsx                # detalhe + EventosTimeline
│   │   │   └── aprovacoes/page.tsx          # inbox OH (resizable)
│   │   └── ocorrencias/
│   │       ├── page.tsx
│   │       ├── [id]/page.tsx
│   │       └── [id]/investigacao/page.tsx   # skeleton (deferido)
│   ├── (admin)/                             # gate: administrador=true
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── page.tsx                     # hub
│   │       ├── usuarios/page.tsx            # convite + toggles
│   │       ├── equipes/page.tsx             # gestão de membros
│   │       ├── configuracoes/page.tsx
│   │       ├── empresas/page.tsx
│   │       ├── unidades/page.tsx
│   │       └── afastamento-tipos/page.tsx
│   └── api/
│       ├── me/route.ts                      # perfil do usuário logado
│       ├── public/
│       │   ├── afastamentos/
│       │   │   ├── route.ts                 # POST submissão
│       │   │   ├── upload/route.ts          # POST anexo
│       │   │   ├── lookup-cpf/route.ts      # POST consulta SOC
│       │   │   └── [token]/route.ts         # GET + PATCH (resubmissão)
│       │   └── ocorrencias/route.ts
│       ├── afastamentos/
│       │   ├── route.ts                     # GET lista com filtros
│       │   └── [id]/
│       │       ├── route.ts                 # GET detalhe
│       │       ├── aprovar/route.ts         # POST (admin ou oh)
│       │       ├── rejeitar/route.ts        # POST (admin ou oh) + motivo
│       │       └── cancelar/route.ts        # POST (admin only)
│       ├── ocorrencias/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── investigacao/route.ts    # POST upsert
│       ├── eventos/[entityType]/[entityId]/route.ts
│       └── admin/
│           ├── usuarios/route.ts            # GET + POST invite
│           ├── usuarios/[id]/route.ts       # PATCH
│           ├── equipes/route.ts
│           ├── equipes/[id]/membros/route.ts   # POST + DELETE
│           ├── configuracoes/route.ts       # GET + PATCH
│           ├── empresas/route.ts            # GET + POST
│           ├── empresas/[id]/route.ts       # PATCH
│           ├── unidades/route.ts
│           ├── unidades/[id]/route.ts
│           ├── afastamento-tipos/route.ts
│           └── afastamento-tipos/[id]/route.ts
├── components/
│   ├── ui/                                  # shadcn primitives (button, label, resizable, etc.)
│   ├── nav/top-nav.tsx
│   ├── gates/equipe-only.tsx                # requireEquipe()
│   ├── admin/crud-table.tsx                 # tabela genérica para empresa/unidade/tipo
│   ├── tables/afastamentos-table.tsx
│   ├── forms/
│   │   ├── afastamento-form.tsx
│   │   ├── ocorrencia-form.tsx
│   │   ├── cpf-lookup.tsx                   # consulta SOC inline
│   │   └── file-upload.tsx
│   ├── afastamentos/
│   │   ├── afastamento-detail.tsx
│   │   ├── aprovacoes-panel.tsx             # resizable list+detail
│   │   └── aprovar-rejeitar-actions.tsx
│   └── eventos-timeline.tsx
├── lib/
│   ├── supabase/
│   │   ├── server.ts                        # cookies-scoped (server components, route handlers)
│   │   ├── client.ts                        # browser
│   │   └── admin.ts                         # service-role (server-only, bypassa RLS)
│   ├── mail/send.ts                         # Resend + registro de templates
│   ├── eventos.ts                           # writeEvento()
│   ├── soc.ts                               # invoca soc-lookup edge fn
│   ├── fluig.ts                             # invoca fluig-push edge fn
│   ├── permissions.ts                       # isAdmin, isInEquipe (helpers para Me)
│   ├── afastamento-state.ts                 # canTransition + isEditAllowed
│   ├── admin-auth.ts                        # requireAdminUser()
│   ├── validation/
│   │   ├── afastamento.ts                   # AfastamentoInputSchema
│   │   └── ocorrencia.ts                    # OcorrenciaInputSchema
│   └── data/
│       ├── cids.json                        # placeholder (3 itens)
│       ├── ufs.json                         # 27 estados
│       ├── ocorrencia_tipos.json            # 5 tipos
│       └── ishikawa.json                    # placeholder (vazio)
├── emails/                                  # templates HTML (todos .ts, sem JSX)
│   ├── _escape.ts
│   ├── _layout.ts
│   ├── _record-table.ts
│   ├── tokens.ts                            # cores email-safe
│   ├── afastamento-receipt.ts
│   ├── afastamento-rejected.ts
│   ├── afastamento-approved.ts
│   ├── folha-auto-accept.ts
│   ├── folha-approved-medical.ts
│   ├── ocorrencia-receipt.ts
│   ├── user-invite.ts                       # pasted into Supabase Dashboard
│   └── password-reset.ts                    # pasted into Supabase Dashboard
└── tests/
    ├── unit/                                # vitest
    │   ├── permissions.test.ts              # 5 testes
    │   ├── validation.test.ts               # 5 testes
    │   ├── eventos.test.ts                  # 2 testes
    │   ├── afastamento-state.test.ts        # 6 testes
    │   └── edit-token.test.ts               # 2 testes (isEditAllowed)
    └── e2e/                                 # playwright
        └── happy-path.spec.ts               # 1 cenário (submit → aprovar)
```

---

## 5. Modelo de dados

### Tabelas principais

```
                 ┌──────────────┐
                 │   usuarios   │ id = auth.users.id
                 ├──────────────┤
                 │ administrador│
                 │ nome, email  │
                 └──────┬───────┘
                        │ N:M
                ┌───────▼────────┐
                │ equipe_usuarios│
                └───────┬────────┘
                        │ N:1
                  ┌─────▼─────┐
                  │  equipes  │   codigo: 'oh' | 'safety'
                  └───────────┘

┌─────────────┐    ┌─────────────┐    ┌──────────────────────┐
│  empresas   │    │  unidades   │    │  afastamento_tipos   │
│  cnpj       │    │  codigo     │    │  codigo, rotulo      │
│  codigo_soc │    │             │    │  requer_aprovacao    │
│  codigo_fluig│   │             │    │  ordem               │
└──────┬──────┘    └──────┬──────┘    └──────────┬───────────┘
       │ N:1              │ N:1                  │ N:1
       │                  │                      │
       └──────────┬───────┴──────────────────────┘
                  │
            ┌─────▼──────────────────────┐
            │     afastamentos           │
            ├────────────────────────────┤
            │ token_edicao (UUID, unique)│   ← link público de edição
            │ cpf, colaborador_nome      │
            │ colaborador_setor/cargo    │
            │ colaborador_codigo_soc     │
            │ data_inicio, data_fim      │
            │ hora_inicio, hora_fim      │
            │ duracao, cid, emissor jsonb│
            │ inss, acidente, internacao │
            │ email_remetente, arquivo_url
            │ situacao (pendente/...)    │
            │ decidido_por, decidido_em  │
            │ motivo_rejeicao            │
            │ enviado_fluig_em           │
            │ criado_em, atualizado_em   │
            └────────────────────────────┘

┌─────────────┐    ┌─────────────┐
│  empresas   │    │  unidades   │
└──────┬──────┘    └──────┬──────┘
       │                  │
       └───────┬──────────┘
               │
        ┌──────▼─────────┐         ┌──────────────────┐
        │   ocorrencias  │  1:1    │  investigacoes   │
        │  tipo, situacao│◄────────┤  dados jsonb     │
        │  data_ocorrencia│        │  situacao        │
        │  descricao     │         └──────────────────┘
        └────────────────┘

                ┌────────────────────┐
                │      eventos       │  ← auditoria unificada
                ├────────────────────┤
                │ tipo_entidade      │  'afastamento' | 'ocorrencia' | 'investigacao'
                │ entidade_id        │
                │ evento             │  'criado','aprovado','rejeitado','resubmetido',...
                │ dados jsonb        │
                │ autor_id           │  → usuarios
                │ ocorrido_em        │
                └────────────────────┘

                ┌────────────────────┐
                │   configuracoes    │  singleton (id = 1)
                ├────────────────────┤
                │ email_folha        │
                │ atualizado_em/por  │
                └────────────────────┘
```

### Convenções de schema

- **Identificadores em PT-BR**: `usuarios`, `equipes`, `afastamentos`, `ocorrencias`, `situacao`, `criado_em`, `atualizado_em`, etc.
- **PKs**: `gen_random_uuid()` por padrão; exceções: `usuarios.id` espelha `auth.users.id`; `configuracoes.id = 1` (singleton).
- **Timestamps**: `criado_em timestamptz not null default now()` + `atualizado_em timestamptz` mantida via trigger `set_atualizado_em()` (definido em `001_extensions.sql`).
- **Soft delete**: campo `ativo boolean` nas tabelas administrativas. Sem `DELETE` real.
- **State machines em CHECK**: situacao tem `check (situacao in (...))` no DDL; a aplicação valida transições via `lib/afastamento-state.ts`.

### Bucket de storage

- `attachments` (privado): recebe os anexos de afastamentos. Upload feito server-side via service-role; download via URL assinada quando necessário. Sem políticas RLS no `storage.objects` — controle todo na aplicação.

---

## 6. Autenticação e autorização

### Camadas

1. **Supabase Auth** controla identidade (email + senha). Usuários são criados via `inviteUserByEmail` a partir do admin; não existe autoinscrição.
2. **`middleware.ts`** (Next.js) refresca a sessão a cada request e redireciona para `/login` quando a rota é protegida e não há sessão. As rotas públicas explicitamente excluídas são `forms/*`, `api/public/*`, `_next/*`, `favicon.ico`. `/afastamentos/editar/[token]` também é tratada como pública (a checagem fica dentro do handler que valida o token).
3. **Layouts gateadores**:
   - `app/(app)/layout.tsx` redireciona para `/login` se não houver usuário.
   - `app/(admin)/layout.tsx` adicionalmente redireciona para `/painel` se `administrador !== true`.
4. **Helpers de aplicação**:
   - `lib/admin-auth.ts → requireAdminUser()` para route handlers que mutam dados administrativos.
   - `components/gates/equipe-only.tsx → requireEquipe('oh' | 'safety')` para páginas (`/afastamentos/aprovacoes`).
   - `lib/permissions.ts → isAdmin(me)`, `isInEquipe(me, codigo)` para checagens síncronas sobre o objeto `Me` carregado pelo `/api/me`.
5. **RLS no Postgres** (`013_rls.sql`) atua como **última linha de defesa para leitura**:
   - `is_admin(uid)` e `is_in_equipe(uid, codigo)` são funções `security definer` que consultam `usuarios` e `equipe_usuarios`.
   - Políticas `SELECT` em todas as 11 tabelas:
     - `usuarios`: vê o próprio ou se for admin.
     - Catálogos (`equipes`, `empresas`, `unidades`, `afastamento_tipos`, `configuracoes`): qualquer usuário autenticado.
     - `afastamentos`: admin OU membro da equipe `oh`.
     - `ocorrencias`/`investigacoes`: admin OU membro da equipe `safety`.
     - `eventos`: cascade da política da entidade pai (via `CASE tipo_entidade`).
   - **Nenhuma política de INSERT/UPDATE/DELETE**: todas as gravações passam pelo `getSupabaseAdmin()` (service-role) nos Route Handlers, depois de a aplicação ter verificado a permissão.

### Modelo de papéis

| Papel               | Como é representado                                   | O que pode fazer                                       |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| **Anônimo público** | Sem sessão                                            | Submeter afastamento/ocorrência via `forms/*`; editar afastamento rejeitado via token. |
| **Comum autenticado** | Linha em `usuarios` com `administrador = false` e sem equipes | Acessar `/painel`; ver detalhes das próprias submissões (futuro — hoje a UI assume equipe ou admin). |
| **OH (equipe `oh`)** | Linha em `equipe_usuarios` com `codigo = 'oh'`        | Tudo de "Comum" + aprovar/rejeitar afastamentos.       |
| **Safety (equipe `safety`)** | Linha em `equipe_usuarios` com `codigo = 'safety'` | Tudo de "Comum" + ver/conduzir investigações (UI deferida). |
| **Admin**           | `usuarios.administrador = true`                       | Tudo do sistema, incluindo CRUDs administrativos e cancelamento. |

> **Nota**: as equipes são fixas — `oh` e `safety` são seedadas em `003_equipes.sql` e não há UI para criar/renomear/remover equipes. A intenção é manter o conjunto mínimo possível.

---

## 7. Fluxos principais

### 7.1 Submissão de afastamento (público)

```
COLABORADOR/RH                                MAIA                              SOC          POSTGRES         RESEND
     │                                          │                                │              │                │
     │── GET /forms/afastamentos ──────────────►│                                │              │                │
     │                                          │── select empresas/unidades/   │              │                │
     │                                          │   tipos (service-role) ───────┼─────────────►│                │
     │◄─── HTML (form + selects) ───────────────│                                │              │                │
     │                                          │                                │              │                │
     │── digita CPF, clica "Buscar" ───────────►│                                │              │                │
     │                                          │── POST /api/public/.../lookup-cpf            │                │
     │                                          │     ├── invoke soc-lookup ───►│              │                │
     │                                          │     │                          │ HTTP SOC ────►│                │
     │                                          │     │                          │◄── JSON      │                │
     │                                          │     └── lookup empresas/      ┼─────────────►│                │
     │                                          │         unidades por código    │              │                │
     │◄─── autofill { nome, setor, cargo, ...}──│                                │              │                │
     │                                          │                                │              │                │
     │── submit ──────────────────────────────►│                                │              │                │
     │                                          │── zod parse                    │              │                │
     │                                          │── busca afastamento_tipos.    │              │                │
     │                                          │   requer_aprovacao ──────────┼─────────────►│                │
     │                                          │── insert afastamento          │              │                │
     │                                          │   (situacao = pendente OU     │              │                │
     │                                          │    finalizado conforme tipo) ─┼─────────────►│                │
     │                                          │── writeEvento 'criado' ───────┼─────────────►│                │
     │                                          │── sendMail receipt ───────────┼──────────────┼───────────────►│
     │                                          │   (e folha-auto-accept se     │              │                │
     │                                          │    finalizado)                 │              │                │
     │◄── { id, token_edicao } ────────────────│                                │              │                │
```

Tipos com `requer_aprovacao = true` (Doença, Acidente, INSS etc.) entram como **pendente** e vão para a inbox da SO.
Tipos com `requer_aprovacao = false` (Casamento, Óbito, Maternidade etc.) entram direto como **finalizado** e disparam um e-mail à folha.

### 7.2 Aprovação OH

```
OH                                MAIA                                 FLUIG       POSTGRES        RESEND
 │                                  │                                    │            │              │
 │── GET /afastamentos/aprovacoes ─►│                                    │            │              │
 │                                  │── requireEquipe('oh')              │            │              │
 │                                  │── select pendentes (RLS aplica)    │            │              │
 │◄── ResizablePanelGroup ──────────│                                    │            │              │
 │                                  │                                    │            │              │
 │── clica "Aprovar" em um item ───►│ POST /api/afastamentos/[id]/aprovar│            │              │
 │                                  │── auth.getUser()                   │            │              │
 │                                  │── verifica admin OU equipe oh      │            │              │
 │                                  │── admin client                     │            │              │
 │                                  │── select afastamento (+ joins) ────┼───────────►│              │
 │                                  │── canTransition(situacao,         │            │              │
 │                                  │   'finalizado')                    │            │              │
 │                                  │── se tipo.requer_aprovacao:        │            │              │
 │                                  │     invoke fluig-push ────────────►│            │              │
 │                                  │       ├── createSimpleDocument ───►│ SOAP       │              │
 │                                  │       └── startProcess ───────────►│ SOAP       │              │
 │                                  │     ◄── { ok: true, response }     │            │              │
 │                                  │     writeEvento 'fluig_enviado' ───┼───────────►│              │
 │                                  │── update situacao='finalizado'    │            │              │
 │                                  │   + decidido_por/em + enviado_fluig┼───────────►│              │
 │                                  │── writeEvento 'aprovado' ─────────►│            │              │
 │                                  │── sendMail approved + folha-medical┼────────────┼─────────────►│
 │◄── { ok: true } ─────────────────│                                    │            │              │
```

**Invariantes importantes**:
- Permissão é verificada **antes** de qualquer uso do service-role.
- Erro do Fluig **não** atualiza `situacao` (early return 502).
- Se o `update` falhar (`upErr`), retorna 500 — não deixamos eventos `aprovado` órfãos.
- Falhas de e-mail são engolidas (try/catch) e registradas como eventos `email_enviado` com `error`.

### 7.3 Rejeição com link de edição

```
OH                  MAIA                          COLABORADOR
 │                    │                                │
 │── Rejeitar ───────►│ POST /api/afastamentos/[id]/rejeitar { motivo }
 │                    │── validações + canTransition (→ rejeitado)
 │                    │── update + motivo_rejeicao
 │                    │── writeEvento 'rejeitado'
 │                    │── sendMail rejected (com editUrl /afastamentos/editar/{token_edicao})
 │                    │
 │                    │                                │── recebe e-mail ──┐
 │                    │                                │                   │
 │                    │     GET /afastamentos/editar/[token] ◄─────────────┘
 │                    │── isEditAllowed? (apenas se situacao='rejeitado')
 │                    │── carrega afastamento + lookups
 │                    │   + banner "Motivo da rejeição: ..."
 │                    │── form prefilled (componente afastamento-form com initial)
 │                    │
 │                    │     PATCH /api/public/afastamentos/[token] {...}
 │                    │── isEditAllowed + canTransition → 'pendente'
 │                    │── update + situacao=pendente + motivo_rejeicao=null
 │                    │── writeEvento 'resubmetido'
 │◄── inbox refletse o registro ressubmetido (volta para pendente)
```

### 7.4 Submissão de ocorrência

Fluxo análogo ao 7.1 mas sem aprovação: ocorrência é registrada com `situacao = 'aberta'` e o autor recebe um e-mail de recibo. A UI de investigação é um placeholder (`/ocorrencias/[id]/investigacao`) — o formulário Ishikawa completo ficou no backlog.

---

## 8. Integrações externas

### 8.1 SOC (consulta de cadastro)

- **O que faz**: dado um CPF, retorna `{ nome, setor, cargo, codigo_soc, codigo_empresa_soc, codigo_unidade_soc }`.
- **Onde**: edge function `maia-db/supabase/functions/soc-lookup/index.ts`.
- **API SOC**: URL `https://ws1.soc.com.br/WebSoc/exportadados` recebe um único query param `parametro` cujo valor é um JSON-stringify das credenciais + CPF. A resposta é **ISO-8859-1** (Latin-1) — decodificada manualmente com `TextDecoder('iso-8859-1')` antes do `JSON.parse`.
- **Quem chama**: `app/api/public/afastamentos/lookup-cpf/route.ts`, acionado pelo componente `<CpfLookup>` no formulário público.
- **Segredos**: `SOC_CODIGO_EP`, `SOC_CODIGO`, `SOC_CHAVE`, `SOC_CODIGO_EMPRESA`. Definidos via `supabase secrets set`.

### 8.2 Fluig (TOTVS — workflow / folha)

- **O que faz**: para cada afastamento médico aprovado, cria um documento (anexo do atestado) e inicia o processo `wkfIntegraAtestado`.
- **Onde**: edge function `maia-db/supabase/functions/fluig-push/index.ts`.
- **Protocolo**: SOAP em duas etapas:
  1. `ECMDocumentService.createSimpleDocument` — faz upload do anexo (base64) e devolve um `documentId`.
  2. `ECMWorkflowEngineService.startProcess` — inicia o processo, passando `documentIdAtestado` dentro de `<cardData>` (lista de pares `<item><item>key</item><item>value</item></item>`).
- **Mapeamento de tipos** (`_shared/types.ts`): apenas os 7 tipos médicos são empurrados ao Fluig (`doenca`, `acidente`, `consulta_medica`, `doacao_sangue`, `realizacao_exames`, `prev_31`, `prev_91`). Os demais retornam `{ skipped: true }`.
- **Segurança XML**: todos os campos dinâmicos passam por `xmlEscape()` antes de serem interpolados na envelope SOAP.
- **Segredos**: `FLUIG_BASE_URL`, `FLUIG_USERNAME`, `FLUIG_PASSWORD`, `FLUIG_PARENT_DOC_ID`, `FLUIG_PROCESS_ID`, **`FLUIG_COMPANY_ID`** (adicionado durante a implementação ao alinhar com o código legado).

### 8.3 Resend (e-mail)

- **SDK**: `resend` v6 (Node, não funciona em edge runtime — por isso o envio sempre acontece no `maia-app`, nunca em edge function).
- **Wrapper**: `lib/mail/send.ts` mantém um registro estático de templates.
- **Inicialização tardia**: `new Resend(process.env.RESEND_API_KEY!)` é construído dentro de `sendMail()` (e não no top-level) porque a v6.12 lança erro imediato se `RESEND_API_KEY` estiver ausente — isso quebrava o boot do dev server em ambientes sem a chave.
- **Segredos**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (no env do Vercel).

### 8.4 Supabase

- **Auth**: invites criados via `admin.auth.admin.inviteUserByEmail()` — o conteúdo do e-mail vem da configuração de Auth Templates no Supabase Dashboard (não do `sendMail`).
- **Postgres**: três clientes no app: `getSupabaseServer()` (escopado nos cookies do request), `getSupabaseBrowser()` e `getSupabaseAdmin()` (service-role).
- **Storage**: bucket `attachments` privado; URLs assinadas geradas sob demanda. O caminho dos uploads de afastamento segue o padrão `afastamentos/staging/{uuid}-{nome}`.

---

## 9. Rotas e endpoints

### Páginas

| Caminho                                | Gate            | Conteúdo                                                          |
| -------------------------------------- | --------------- | ----------------------------------------------------------------- |
| `/`                                    | público         | landing/redirect                                                  |
| `/login`                               | público         | login com email/senha                                             |
| `/forgot-password`                     | público         | requisita reset                                                   |
| `/update-password`                     | público         | seta nova senha (após invite ou recovery)                         |
| `/forms/afastamentos`                  | público         | formulário público de afastamento                                 |
| `/forms/ocorrencias`                   | público         | formulário público de ocorrência                                  |
| `/afastamentos/editar/[token]`         | público (token) | reenvio do afastamento rejeitado                                  |
| `/painel`                              | autenticado     | contagem de pendências + recentes                                 |
| `/afastamentos`                        | autenticado     | lista com filtros via query string                                |
| `/afastamentos/[id]`                   | autenticado     | detalhe + timeline                                                |
| `/afastamentos/aprovacoes`             | equipe `oh`     | inbox redimensionável (lista + detalhe + ações)                   |
| `/ocorrencias`                         | autenticado     | lista                                                             |
| `/ocorrencias/[id]`                    | autenticado     | detalhe + link para investigação                                  |
| `/ocorrencias/[id]/investigacao`       | autenticado     | skeleton (TODO completo)                                          |
| `/admin`                               | admin           | hub                                                               |
| `/admin/usuarios`                      | admin           | listar + convidar + toggle admin/ativo                            |
| `/admin/equipes`                       | admin           | adicionar/remover membros das equipes                             |
| `/admin/configuracoes`                 | admin           | email da folha                                                    |
| `/admin/empresas`                      | admin           | CRUD genérico (AdminCrudTable)                                    |
| `/admin/unidades`                      | admin           | CRUD genérico                                                     |
| `/admin/afastamento-tipos`             | admin           | CRUD genérico                                                     |

### Route Handlers

| Método  | Endpoint                                                | Resumo                                                           |
| ------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| GET     | `/api/me`                                               | usuário + equipes do JWT                                         |
| POST    | `/api/public/afastamentos`                              | submete afastamento, dispara recibo + folha-auto-accept          |
| POST    | `/api/public/afastamentos/upload`                       | upload do anexo (pdf/jpg/png/webp, ≤10 MB)                       |
| POST    | `/api/public/afastamentos/lookup-cpf`                   | invoca soc-lookup + cruza com empresas/unidades                  |
| GET     | `/api/public/afastamentos/[token]`                      | carrega afastamento por token de edição                          |
| PATCH   | `/api/public/afastamentos/[token]`                      | resubmissão (gate `isEditAllowed`)                               |
| POST    | `/api/public/ocorrencias`                               | registra ocorrência + recibo                                     |
| GET     | `/api/afastamentos`                                     | lista com 8 filtros (`situacao`, `tipo`, `empresa_id`, `unidade_id`, `cpf`, `from`, `to`, `q`) |
| GET     | `/api/afastamentos/[id]`                                | detalhe                                                          |
| POST    | `/api/afastamentos/[id]/aprovar`                        | admin OU oh; push Fluig + update + e-mails                       |
| POST    | `/api/afastamentos/[id]/rejeitar`                       | admin OU oh; motivo obrigatório (≥3 chars); e-mail com editUrl   |
| POST    | `/api/afastamentos/[id]/cancelar`                       | admin only; pendente/rejeitado → cancelado                       |
| GET     | `/api/ocorrencias`                                      | lista                                                             |
| GET     | `/api/ocorrencias/[id]`                                 | detalhe + investigações                                          |
| POST    | `/api/ocorrencias/[id]/investigacao`                    | upsert investigação                                              |
| GET     | `/api/eventos/[entityType]/[entityId]`                  | histórico unificado                                              |
| GET/POST   | `/api/admin/usuarios`                                | listar / convidar (Supabase invite + cleanup órfão)              |
| PATCH   | `/api/admin/usuarios/[id]`                              | renomear, toggle admin/ativo                                     |
| GET     | `/api/admin/equipes`                                    | equipes + membros                                                |
| POST/DELETE | `/api/admin/equipes/[id]/membros`                   | adicionar / remover membro                                       |
| GET/PATCH | `/api/admin/configuracoes`                            | singleton                                                        |
| GET/POST | `/api/admin/empresas` + PATCH `/[id]`                  | CRUD                                                             |
| GET/POST | `/api/admin/unidades` + PATCH `/[id]`                  | CRUD                                                             |
| GET/POST | `/api/admin/afastamento-tipos` + PATCH `/[id]`         | CRUD                                                             |

### Edge functions

| Função        | Método | Body                              | Responsabilidade                              |
| ------------- | ------ | --------------------------------- | --------------------------------------------- |
| `soc-lookup`  | POST   | `{ cpf }`                         | Consulta SOC, devolve perfil do colaborador   |
| `fluig-push`  | POST   | `FluigPushPayload`                | Cria documento + inicia processo no Fluig     |

---

## 10. Sistema de e-mails

| Template                          | Disparado por                                                   | Quem recebe                                   |
| --------------------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| `afastamento-receipt`             | POST `/api/public/afastamentos`                                 | autor (email_remetente)                       |
| `folha-auto-accept`               | POST `/api/public/afastamentos` (se finalizado direto)          | `configuracoes.email_folha`                   |
| `afastamento-approved`            | POST `/api/afastamentos/[id]/aprovar`                           | autor                                         |
| `folha-approved-medical`          | POST `/api/afastamentos/[id]/aprovar`                           | `configuracoes.email_folha`                   |
| `afastamento-rejected`            | POST `/api/afastamentos/[id]/rejeitar` (inclui `editUrl`)       | autor                                         |
| `ocorrencia-receipt`              | POST `/api/public/ocorrencias`                                  | autor                                         |
| `user-invite` *                   | (pasted into) Supabase Dashboard → Auth → Invite user           | Supabase dispara automaticamente              |
| `password-reset` *                | (pasted into) Supabase Dashboard → Auth → Reset password        | Supabase dispara automaticamente              |

**Estrutura**: cada template é uma função TypeScript `(data) => string` que monta HTML puro com CSS inline. Componentes compartilhados:
- `emails/_layout.ts` (`layout(title, bodyHtml)`)
- `emails/_record-table.ts` (`recordTable(rows)`)
- `emails/_escape.ts` (`escapeHtml`)
- `emails/tokens.ts` (paleta de cores)

**Por que HTML puro?** Para manter dependências mínimas (sem React Email + render) e garantir compatibilidade com qualquer cliente de e-mail sem depender de runtime de serialização.

\* `user-invite` e `password-reset` **não** são despachados via `lib/mail/send.ts`. Eles existem apenas para gerar HTML via `scripts/output/*.html` que é colado na configuração de Auth → Email Templates do Supabase Dashboard. O envio real é feito pelo próprio Supabase quando `inviteUserByEmail` ou `resetPasswordForEmail` é chamado.

---

## 11. Auditoria (eventos)

A tabela `eventos` é a única fonte de auditoria. Cada Route Handler que muda estado escreve um `evento` via `lib/eventos.ts → writeEvento(...)`.

### Tipos atuais (`EventoType`)

| `evento`           | Quando                                                                  |
| ------------------ | ----------------------------------------------------------------------- |
| `criado`           | submissão pública de afastamento ou ocorrência                          |
| `aprovado`         | aprovação OH                                                            |
| `rejeitado`        | rejeição OH                                                             |
| `resubmetido`      | autor reenvia via link de edição                                        |
| `cancelado`        | admin cancela                                                           |
| `fluig_enviado`    | push Fluig retorna `ok: true`                                           |
| `fluig_erro`       | push Fluig falha ou lança                                               |
| `email_enviado`    | qualquer template (sucesso ou erro — `dados.error` diferencia)          |

Todos os eventos carregam:
- `tipo_entidade` (`afastamento` | `ocorrencia` | `investigacao`)
- `entidade_id`
- `autor_id` (quando autenticado; null para fluxos públicos)
- `dados jsonb` (payload arbitrário — motivo, response, error, etc.)

A timeline na UI (`components/eventos-timeline.tsx`) faz fetch de `/api/eventos/[entityType]/[entityId]` e renderiza com rótulos PT-BR.

---

## 12. Design system

### Tokens

Definidos em `app/tokens.css` e expostos ao Tailwind 4 via `@theme inline` em `app/globals.css`:

- **Cores**: bg, bg-subtle, fg, fg-muted, border, primary (#1e40af azul ENGEKO placeholder), primary-fg, primary-hover, success (#16a34a), warning (#d97706), danger (#dc2626), info (#2563eb).
- **Espaçamento**: `--space-1` a `--space-12` em passos discretos.
- **Tipografia**: `--font-sans` (Inter, system-ui), `--font-mono` (JetBrains Mono). `--text-xs` a `--text-3xl`.
- **Radius**: sm/md/lg/full.
- **Sombra**: sm/md/lg.

### Componentes

- **shadcn/ui** para primitivas (button, label, separator, textarea, resizable). Sempre instalados sob demanda com `npx shadcn@latest add <name>`.
- **Custom**: `components/forms/*`, `components/afastamentos/*`, `components/admin/crud-table.tsx`, `components/eventos-timeline.tsx`, `components/nav/top-nav.tsx`.
- **Convenção**: classes Tailwind diretas em JSX; cores via `bg-[var(--color-success)]`, `text-[var(--color-danger)]` quando o token não está exposto no `@theme` (apenas `border`, `primary`, `muted`, `destructive` foram aliasados; os demais ficam em arbitrary-value).

### E-mail

Tokens próprios em `emails/tokens.ts` — espelham as cores do app mas em hex literal para inlining seguro (sem depender de variáveis CSS no e-mail).

---

## 13. Testes

### Vitest (20 testes, 5 arquivos)

| Arquivo                                            | Cobertura                                                 |
| -------------------------------------------------- | --------------------------------------------------------- |
| `tests/unit/permissions.test.ts`                   | `isAdmin`, `isInEquipe` (5)                                |
| `tests/unit/validation.test.ts`                    | `AfastamentoInputSchema` (5: payload válido, CPF, e-mail, emissor CRM/CRO, rejeição OAB) |
| `tests/unit/eventos.test.ts`                       | `writeEvento` com mocks (2)                                |
| `tests/unit/afastamento-state.test.ts`             | `canTransition` para todas as 6 transições válidas + denials |
| `tests/unit/edit-token.test.ts`                    | `isEditAllowed` (2: só permite quando rejeitado)           |

Comando: `npx vitest run` (ou `npm test` se um script for adicionado).

### Deno (4 testes)

`maia-db/supabase/functions/_shared/fluig-mapping.test.ts` — `mapTipoToFluigCode` para tipos médicos, não-médicos, desconhecidos.

Comando: `cd maia-db && deno test supabase/functions/_shared/fluig-mapping.test.ts`.

### Playwright (1 cenário E2E)

`tests/e2e/happy-path.spec.ts` — submissão pública → autofill SOC → aprovação OH → confirma toast "Aprovado.".

**Pré-requisitos**: ambiente deployado (Supabase cloud, edge functions ativas, Vercel, e-mail real) + env vars `E2E_BASE_URL`, `E2E_OH_EMAIL`, `E2E_OH_PASSWORD`, `E2E_TEST_CPF`.

Comando: `npx playwright test`.

### Smoke psql (RLS)

`maia-db/supabase/tests/rls.sql` valida que admin e membro `oh` veem o afastamento de teste, mas um usuário aleatório vê zero. Roda contra o Postgres local (após `make db-reset`).

Comando: `psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -f supabase/tests/rls.sql`.

---

## 14. Variáveis de ambiente

### maia-app (Vercel e/ou `.env.local`)

| Variável                            | Lugar          | Uso                                                       |
| ----------------------------------- | -------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`          | Vercel + local | URL base do projeto Supabase                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`     | Vercel + local | Chave anon, usada pelo client/server                      |
| `SUPABASE_SERVICE_ROLE_KEY`         | Vercel + local | Service-role, **nunca exposta ao browser**                |
| `RESEND_API_KEY`                    | Vercel + local | Resend                                                    |
| `RESEND_FROM_EMAIL`                 | Vercel + local | Ex: `No-Reply | MAIA <nr-maia@heizen.io>`                  |
| `SUPABASE_EDGE_FN_FLUIG`            | Vercel         | (Opcional — usado se a invocação por nome precisar de URL explícita) |
| `SUPABASE_EDGE_FN_SOC`              | Vercel         | (Opcional)                                                |
| `NEXT_PUBLIC_APP_BASE_URL`          | Vercel + local | Ex: `https://maia.engeko.com.br`. Usado para gerar links em e-mails (edit-token). |

### maia-db (Supabase secrets via `supabase secrets set`)

| Variável                | Usada por      | Conteúdo                                              |
| ----------------------- | -------------- | ----------------------------------------------------- |
| `SOC_CODIGO_EP`         | `soc-lookup`   | Código da empresa-resposta no SOC                     |
| `SOC_CODIGO`            | `soc-lookup`   | Código da exportação                                  |
| `SOC_CHAVE`             | `soc-lookup`   | Chave de autenticação SOC                             |
| `SOC_CODIGO_EMPRESA`    | `soc-lookup`   | Código da empresa-de-trabalho                         |
| `FLUIG_BASE_URL`        | `fluig-push`   | URL base do webdesk Fluig                             |
| `FLUIG_USERNAME`        | `fluig-push`   | Usuário do serviço (rotacionado — não reutilizar antigo) |
| `FLUIG_PASSWORD`        | `fluig-push`   | Senha do serviço (rotacionada)                        |
| `FLUIG_PARENT_DOC_ID`   | `fluig-push`   | ID do documento pai para uploads (legacy: `141244`)   |
| `FLUIG_PROCESS_ID`      | `fluig-push`   | ID do processo (legacy: `wkfIntegraAtestado`)         |
| `FLUIG_COMPANY_ID`      | `fluig-push`   | ID numérico da empresa no Fluig (necessário em `startProcess`) |

---

## 15. Deploy

### Sequência canônica

1. **Criar projeto Supabase** (cloud) — copiar `Project Ref`.
2. **Vincular `maia-db`** e publicar schema:
   ```bash
   cd /Users/heizen/DEV/maia-db
   supabase login
   supabase link --project-ref <ref>
   make db-push
   ```
3. **Deployar edge functions**:
   ```bash
   make functions-deploy
   ```
4. **Configurar segredos do `maia-db`** (`supabase secrets set ...`) — todos os SOC_* e FLUIG_*.
5. **Criar usuário admin inicial**:
   - Supabase Dashboard → Auth → Add user (email + senha).
   - SQL Editor: `insert into usuarios (id, nome, email, administrador, ativo) values ('<auth-uid>', 'Admin', 'admin@engeko.com.br', true, true);`
6. **Substituir placeholders de seed**:
   - Editar `014_seed.sql` com CNPJs reais da ENGEKO e suas unidades.
   - Substituir `lib/data/cids.json` pela lista CID-10 fornecida pela SO.
   - Rodar `make db-push` novamente (a migration `014_seed.sql` precisa rodar com os dados reais).
7. **Configurar SMTP customizado** (Supabase Dashboard → Project Settings → Auth → SMTP Settings) com credenciais Resend.
8. **Configurar Auth Templates** (Dashboard → Authentication → Email Templates) colando o HTML de `maia-app/scripts/output/user-invite.html` e `password-reset.html`.
9. **Criar projeto Vercel**:
   ```bash
   cd /Users/heizen/DEV/maia-app
   npx vercel link
   # adicionar todas as 8 envs em production
   npx vercel --prod
   ```
10. **Domínio customizado** no Vercel (ex: `maia.engeko.com.br`) — esperar SSL.
11. **Smoke manual end-to-end**:
    - Visitar `/forms/afastamentos` → submeter (medical).
    - Login como admin → convidar usuário OH real → adicionar à equipe `oh`.
    - OH loga, aprova, confirma e-mails e push Fluig.
12. **Smoke automatizado** (opcional):
    ```bash
    E2E_BASE_URL=https://maia.engeko.com.br \
    E2E_OH_EMAIL=... E2E_OH_PASSWORD=... \
    E2E_TEST_CPF=... \
    npx playwright test
    ```

### Quando algo dá errado

- **Edge function 502**: cheque `supabase secrets list` — algum SOC_* ou FLUIG_* faltando.
- **Resend rejeita o e-mail**: confirme que o domínio remetente está verificado no painel do Resend.
- **Página em loop de redirect para /login**: `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` ausente — middleware falha em criar o client.
- **`make db-reset` quebra localmente**: Docker do Supabase precisa estar rodando (`supabase start`).
- **Convite admin não cria linha em `usuarios`**: a função usa `inviteUserByEmail` + `insert` em duas etapas; se o `insert` falhar, removemos o `auth.user` órfão (linha ~50 de `api/admin/usuarios/route.ts`). Confira o motivo do erro no campo `error.message`.

---

## 16. Convenções

- **PT-BR para tudo que é texto humano**: identificadores de código mantêm convenções técnicas (camelCase, etc.), mas linhas de texto, comentários explicativos, README, UI, mensagens de erro e e-mails são em português.
- **Mínimo de dependências**: shadcn + Tailwind cobrem a UI. Sem Radix individual, sem React Email, sem outras libs de componentes.
- **npm**: nunca pnpm/yarn/bun. Lockfile commitado: `package-lock.json`.
- **Migrações são imutáveis depois de deployadas**: para mudar schema, criar `015_*.sql` em vez de editar uma migration antiga.
- **Service-role só no servidor**: nunca importar `lib/supabase/admin.ts` em código com `"use client"`.
- **Permission check antes do admin client**: o padrão é: identificar via `getSupabaseServer()` → checar permissão na tabela `usuarios`/`equipe_usuarios` → só então usar `getSupabaseAdmin()` para mutar.
- **Sempre logar evento em mutações**: cada `update` de afastamento/ocorrência/investigação tem um `writeEvento(...)` correspondente.
- **Erros de e-mail não derrubam o fluxo**: envoltos em try/catch, registrados como `eventos.email_enviado` com `dados.error`.
- **Erros de update derrubam o fluxo**: capturar `upErr` e retornar 500. Eventos só após confirmação do update.

---

## 17. Backlog e oportunidades de melhoria

A especificação foi deliberadamente enxuta. Esta seção lista o que ficou de fora (intencionalmente) e ideias que faz sentido considerar para v1.x ou v2.

### Já mapeado como deferido

| Item                                                | Por que ficou de fora                                              |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| Formulário Ishikawa de investigação                 | Equipe `safety` ainda não está ativa operacionalmente              |
| Filtros UI na lista de afastamentos (`filters-bar`) | Endpoint já aceita filtros via query string; UI dedicada não foi montada |
| Previews de anexos (signed URL endpoint)            | Detalhe mostra link, mas `/api/public/afastamentos/upload/preview` não existe |
| CID-10 completo (~14k linhas)                       | Aguardando lista oficial da SO                                     |
| Lista real de unidades / contratos                  | Aguardando seed da ENGEKO                                          |
| Página "minhas submissões" para o autor             | Modelo atual identifica autor por e-mail; não há área dele logada  |
| OAuth providers (Google)                            | Out of scope para v1                                               |

### Oportunidades que valem discussão

#### 17.1 Pequenas vitórias

- **Singleton do client Resend**: hoje `new Resend(...)` é construído a cada `sendMail()` — ok para volume baixo, mas vale promover para um módulo-level `let resend: Resend | null` lazy.
- **Validação de UUID nos handlers**: a maioria dos `[id]/route.ts` confia que o Supabase rejeita IDs malformados. Adicionar `z.string().uuid().parse(id)` no topo deixa o 400 explícito.
- **`rejeitar/route.ts` faz dois fetches**: o primeiro busca `situacao`, o segundo busca os campos para o e-mail. Pode-se selecionar tudo no primeiro fetch, como `aprovar/route.ts` já faz.
- **Cor `--color-success` e `--color-danger` não estão no `@theme inline`**: hoje viramos para `bg-[var(--color-success)]`. Aliasar essas duas no `globals.css` simplifica os componentes.
- **`(any) =>` em joins**: várias chamadas `(m: any) => m.equipes?.codigo` ficaram com cast por causa de tipos não-gerados do supabase-js. Rodar `supabase gen types typescript --linked` cria tipos derivados do schema e elimina a maioria.
- **Limites de upload**: hoje verificamos `size <= 10MB` e MIME em uma única route handler. Vale adicionar antivírus (ClamAV via worker?) ou pelo menos validação de magic bytes — clientes ocupacionais frequentemente recebem PDFs problemáticos.

#### 17.2 Médio prazo

- **Soft-locks contra race**: aprovação concorrente em janelas múltiplas pode causar dois updates. Para uma operação OH single-user é negligível, mas escrever o update com `where situacao = 'pendente'` (optimistic lock) blinda o cenário.
- **Logs estruturados**: as edge functions e os route handlers só registram em `console.log`/`error`. Vale plugar um sink (Logflare, Better Stack) e padronizar JSON com `request_id`, `user_id`, `route`, `duration_ms`.
- **Dashboard de operação**: hoje o painel tem só "pendentes". Vale uma página `/painel/saude` mostrando: e-mails que falharam (últimas 24h), pushes Fluig que falharam, latência média, distribuição de tipos no mês.
- **Versionamento de schema dos formulários**: o formulário público está acoplado às colunas atuais. Se a ENGEKO pedir 3 novos campos, eles precisam ir tanto no zod quanto no DDL e quanto no template do e-mail. Vale considerar uma tabela `form_definitions` (jsonb com schema do formulário) — mas só se essa mudança virar frequente.
- **Permissões mais granulares**: o modelo atual é binário (admin/equipe). Conforme novos times surjam, considerar capabilities (uma tabela `permissoes` com `nome` + `equipe_id`).
- **Histórico de motivos de rejeição**: hoje `motivo_rejeicao` é sobrescrito no PATCH/resubmit. A timeline de eventos guarda o histórico, mas vale uma tabela `rejeicoes` ou aceitar que o evento é o source-of-truth.
- **Reabertura de afastamento finalizado**: o state machine não permite. Se a ENGEKO pedir, considerar `finalizado → pendente` com permissão admin-only e um motivo obrigatório.

#### 17.3 Maior fôlego

- **Investigação completa de ocorrência**: o esqueleto está pronto (`ocorrencias/[id]/investigacao/page.tsx`). Para implementar:
  - definir o schema Ishikawa em `lib/data/ishikawa.json` (cabeçalho, 6Ms, perguntas);
  - guardar o estado em `investigacoes.dados` jsonb;
  - timeline da investigação no mesmo padrão de eventos;
  - notificações para a equipe `safety` quando uma ocorrência é registrada.
- **Mobile-first / PWA**: o formulário público é onde o colaborador entra mais. Hoje funciona em mobile, mas não há otimização — instalação como PWA + reset de senha por SMS (Supabase + Twilio) seriam valor real.
- **Multi-empresa de novo (mas controlado)**: se a ENGEKO virar uma holding e quiser separar empresas-filhas operacionalmente, o pivot é: adicionar `tenant_id` em `usuarios`/`equipes`/`afastamentos`/`ocorrencias` e ajustar as políticas RLS. Levaria ~2 dias com este código como base, porque já existe o esqueleto de `empresas`.
- **Self-service do colaborador**: hoje o colaborador é puramente passivo (recebe e-mails). Um portal mínimo com login (apenas próprio CPF + senha SMS) e visualização de "meus afastamentos" cobre 80% das ligações de "cadê meu atestado?".

### Pontos de risco operacional para revisitar tomorrow

1. **CNPJ + unidades + CIDs ainda são placeholders**. Antes do go-live, isso precisa ser substituído. Sugiro um script `scripts/seed-engeko.ts` que lê de um YAML/CSV controlado pela SO.
2. **Sem rate limiting nos endpoints públicos**. `/forms/afastamentos` e `/api/public/afastamentos` aceitam qualquer volume. Vale colocar Cloudflare na frente do domínio (ou usar Vercel Edge Config / um rate-limit simples baseado em IP+CPF).
3. **Token de edição não expira**. Calendly-style, é estável para sempre. Está intencional, mas vale documentar para o auditor que o `token_edicao` só funciona enquanto `situacao = 'rejeitado'`.
4. **Anexos não são validados antivirus/PDF**. Para ambiente médico isso pode ser uma exigência LGPD/jurídica.
5. **Push Fluig não tem retry automático**. Se a SOAP cair, `evento.fluig_erro` é gravado mas a aprovação retorna 502 e o `situacao` fica como pendente (não muda). Vale uma fila de retry — pode ser um cron que reaprovar afastamentos com `evento.fluig_erro` mais recente que `evento.fluig_enviado`.

---

> Esta documentação reflete o estado do sistema ao final da execução do plano `docs/superpowers/plans/2026-05-13-maia-rebuild.md`, em **2026-05-13**. Atualizar quando schema, fluxos ou integrações mudarem.
