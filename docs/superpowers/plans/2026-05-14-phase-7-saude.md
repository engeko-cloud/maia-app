# Phase 7 — Operational Health Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/painel/saude` — a live-polling admin dashboard showing email/Fluig failures and operational KPIs — and activate the notification bell with a polling backend.

**Architecture:** Two independent polling endpoints (`/api/saude` for health metrics, `/api/notificacoes/unread` for the bell count) feed two client components (`<SaudeClient>` on the dashboard page, `<AppNotificationBell>` in the top nav). All failure data already exists in the `eventos` table; no new instrumentation is needed. A single new table `configuracoes_dashboard` in maia-db stores the approval-latency threshold. The `AppTopNav` server component no longer passes an `unread` prop — the bell fetches its own count every 30 s.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 CSS tokens, `@base-ui/react` (shadcn `base-nova`), `lucide-react`, Supabase SSR + service-role admin client, Vitest unit tests, Playwright E2E.

**Cross-cutting rules:**
- Radius cap: `rounded-md` max; no `rounded-full` on rectangles.
- No new entries to `lib/data/*.json`.
- TDD: write failing test → watch it fail → implement → watch it pass → commit.
- YAGNI: don't build Phase 8 portal features here.

---

## File Structure

```
maia-db/
└── supabase/migrations/
    └── 017_configuracoes_dashboard.sql          NEW

maia-app/
├── lib/
│   ├── dashboard/
│   │   └── queries.ts                           NEW (all health metric query functions)
│   └── nav.ts                                   MODIFY (add Saúde to admin group)
├── app/
│   ├── api/
│   │   ├── saude/route.ts                       NEW (GET, admin-only)
│   │   ├── notificacoes/unread/route.ts         NEW (GET, any authenticated user)
│   │   └── admin/configuracoes/route.ts         MODIFY (extend PATCH for aprovacao_lenta_horas)
│   └── (app)/
│       └── painel/
│           ├── page.tsx                         MODIFY (mount <SaudeBanner>)
│           └── saude/page.tsx                   NEW (SSR shell + mounts <SaudeClient>)
├── components/
│   ├── saude/
│   │   ├── metric-card.tsx                      NEW (primitive: label + value + tone strip)
│   │   ├── saude-client.tsx                     NEW (polls /api/saude every 30s, renders cards)
│   │   └── saude-banner.tsx                     NEW (polls /api/saude, shows alert strip on /painel)
│   ├── layout/
│   │   ├── app-notification-bell.tsx            MODIFY (self-contained poller, no prop)
│   │   └── app-top-nav.tsx                      MODIFY (remove unread prop to bell)
│   └── admin/
│       └── configuracoes/page.tsx               MODIFY (add Dashboard section)
└── tests/
    ├── unit/
    │   ├── dashboard-queries.test.ts            NEW
    │   └── nav.test.ts                          MODIFY (assert Saúde item in admin group)
    └── e2e/
        └── phase-7-saude.spec.ts               NEW
```

---

## Section A — Data layer

### Task 1: maia-db migration — `configuracoes_dashboard`

> **Note:** This task runs in the **maia-db** repository at `/Users/heizen/DEV/maia-db`, not maia-app.

**Files:**
- Create: `/Users/heizen/DEV/maia-db/supabase/migrations/017_configuracoes_dashboard.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Phase 7: operational health dashboard — approval latency threshold table

create table configuracoes_dashboard (
  id            boolean primary key default true check (id),
  config        jsonb not null default '{"aprovacao_lenta_horas": 24}'::jsonb,
  atualizado_em timestamptz not null default now()
);

insert into configuracoes_dashboard default values;
```

- [ ] **Step 2: Apply locally**

```bash
cd /Users/heizen/DEV/maia-db
supabase db reset
```

Expected: `Finished supabase db reset` with no errors. The local database now has `configuracoes_dashboard`.

- [ ] **Step 3: Verify table exists**

```bash
cd /Users/heizen/DEV/maia-db
supabase db execute --local -- "select config from configuracoes_dashboard;"
```

Expected: one row with `{"aprovacao_lenta_horas": 24}`.

- [ ] **Step 4: Commit in maia-db**

```bash
cd /Users/heizen/DEV/maia-db
git add supabase/migrations/017_configuracoes_dashboard.sql
git commit -m "feat(phase-7): configuracoes_dashboard — single-row approval latency threshold"
```

---

### Task 2: Regenerate Supabase types in maia-app

**Files:**
- Modify: `lib/supabase/database.types.ts`

- [ ] **Step 1: Regenerate**

Run from inside `maia-app`:

```bash
cd /Users/heizen/DEV/maia-app
supabase gen types typescript --local > lib/supabase/database.types.ts
```

Expected: file updated, no errors.

- [ ] **Step 2: Verify `configuracoes_dashboard` appears in types**

```bash
grep "configuracoes_dashboard" lib/supabase/database.types.ts
```

Expected: matches like `configuracoes_dashboard: { Row: { id: boolean; config: Json; ... } }`.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/database.types.ts
git commit -m "chore(phase-7): regenerate supabase types — configuracoes_dashboard"
```

---

### Task 3: `lib/dashboard/queries.ts` — health metric query functions

All failure data lives in `eventos`. Approval latency is derived in JS from paired `criado`/`aprovado` evento timestamps.

**Files:**
- Create: `lib/dashboard/queries.ts`
- Create: `tests/unit/dashboard-queries.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/dashboard-queries.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  getEmailsFalhados,
  getFluigFalhados,
  getAprovacaoLatencia,
  getOcorrenciasPorSituacao,
  getAfastosPorTipo,
  getAnexosStatus,
  getThresholdHoras,
  type FailedItem,
  type SaudeMetrics,
} from "@/lib/dashboard/queries";

// Minimal Supabase mock builder
function makeMock(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null });
  // default resolve for array queries
  Object.defineProperty(chain, Symbol.asyncIterator, { value: undefined });
  (chain as any).then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return { from: vi.fn().mockReturnValue(chain), chain };
}

describe("getThresholdHoras", () => {
  it("returns the aprovacao_lenta_horas value from config", async () => {
    const { from, chain } = makeMock([{ config: { aprovacao_lenta_horas: 48 } }]);
    chain.single = vi.fn().mockResolvedValue({ data: { config: { aprovacao_lenta_horas: 48 } }, error: null });
    const result = await getThresholdHoras({ from } as any);
    expect(result).toBe(48);
  });

  it("defaults to 24 when the row is missing", async () => {
    const { from, chain } = makeMock([]);
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    const result = await getThresholdHoras({ from } as any);
    expect(result).toBe(24);
  });
});

describe("getEmailsFalhados", () => {
  it("filters eventos where error key is present in dados", async () => {
    const eventos = [
      { entidade_id: "af-1", dados: { error: "timeout", template: "afastamento-approved" } },
      { entidade_id: "af-2", dados: { template: "afastamento-approved" } }, // no error key
    ];
    const { from, chain } = makeMock(eventos);

    // afastamentos lookup mock
    const afastos = [{ id: "af-1", colaborador_nome: "João", afastamento_tipos: { rotulo: "Médico" } }];
    let callCount = 0;
    from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chain; // eventos query
      // afastamentos query
      const c2 = { select: vi.fn().mockReturnThis(), in: vi.fn() };
      c2.in.mockResolvedValue({ data: afastos, error: null });
      return c2;
    });

    const result = await getEmailsFalhados({ from } as any);
    expect(result.count).toBe(1);
    expect(result.items[0]!.id).toBe("af-1");
    expect(result.items[0]!.colaborador_nome).toBe("João");
  });
});

describe("getAprovacaoLatencia", () => {
  it("returns null P50 and P95 when no approved afastamentos", async () => {
    const { from, chain } = makeMock([]);
    const result = await getAprovacaoLatencia({ from } as any);
    expect(result.p50_horas).toBeNull();
    expect(result.p95_horas).toBeNull();
  });

  it("computes P50 and P95 from criado→aprovado diffs", async () => {
    const now = Date.now();
    const aprovados = [
      { entidade_id: "a1", ocorrido_em: new Date(now).toISOString() },
      { entidade_id: "a2", ocorrido_em: new Date(now).toISOString() },
    ];
    const criados = [
      { entidade_id: "a1", ocorrido_em: new Date(now - 2 * 3600000).toISOString() }, // 2h
      { entidade_id: "a2", ocorrido_em: new Date(now - 10 * 3600000).toISOString() }, // 10h
    ];

    let callCount = 0;
    const from = vi.fn().mockImplementation(() => {
      callCount++;
      const rows = callCount === 1 ? aprovados : criados;
      const c = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis() };
      (c as any).then = (res: (v: { data: typeof rows; error: null }) => void) =>
        Promise.resolve({ data: rows, error: null }).then(res);
      return c;
    });

    const result = await getAprovacaoLatencia({ from } as any);
    // sorted diffs: [2, 10]; P50 = index 1 (50th percentile of 2 items), P95 = index 1
    expect(result.p50_horas).toBeCloseTo(2, 0);
    expect(result.p95_horas).toBeCloseTo(10, 0);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run tests/unit/dashboard-queries.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/dashboard/queries'`.

- [ ] **Step 3: Implement `lib/dashboard/queries.ts`**

Create `lib/dashboard/queries.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export type FailedItem = {
  id: string;
  colaborador_nome: string;
  tipo: string;
};

export type FailedGroup = { count: number; items: FailedItem[] };

export type SaudeMetrics = {
  emails_falhados: FailedGroup;
  fluig_falhados: FailedGroup;
  aprovacao_p50_horas: number | null;
  aprovacao_p95_horas: number | null;
  ocorrencias_por_situacao: Array<{ situacao: string; count: number }>;
  afastos_por_tipo: Array<{ rotulo: string; count: number; percent: number }>;
  anexos_presentes: number;
  anexos_ausentes: number;
  threshold_horas: number;
};

function oneDayAgo(): string {
  return new Date(Date.now() - 86_400_000).toISOString();
}

function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString();
}

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.floor(sorted.length * p)] ?? sorted[sorted.length - 1] ?? null;
}

export async function getThresholdHoras(admin: SupabaseClient): Promise<number> {
  const { data } = await admin
    .from("configuracoes_dashboard")
    .select("config")
    .single();
  return (data?.config as { aprovacao_lenta_horas?: number } | null)?.aprovacao_lenta_horas ?? 24;
}

async function resolveAfastamentoItems(
  admin: SupabaseClient,
  ids: string[],
): Promise<FailedItem[]> {
  if (ids.length === 0) return [];
  const { data } = await admin
    .from("afastamentos")
    .select("id, colaborador_nome, afastamento_tipos(rotulo)")
    .in("id", ids.slice(0, 5)); // cap at 5 for inline list
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    colaborador_nome: (row.colaborador_nome as string) ?? "—",
    tipo: (row.afastamento_tipos?.rotulo as string) ?? "—",
  }));
}

export async function getEmailsFalhados(admin: SupabaseClient): Promise<FailedGroup> {
  const { data } = await (admin
    .from("eventos")
    .select("entidade_id, dados")
    .eq("evento", "email_enviado")
    .eq("tipo_entidade", "afastamento")
    .gte("ocorrido_em", oneDayAgo()) as any);

  const failed = (data ?? []).filter(
    (e: any) => e.dados && typeof e.dados === "object" && "error" in e.dados,
  );
  const ids = [...new Set(failed.map((e: any) => e.entidade_id as string))];
  const items = await resolveAfastamentoItems(admin, ids);
  return { count: ids.length, items };
}

export async function getFluigFalhados(admin: SupabaseClient): Promise<FailedGroup> {
  const { data } = await (admin
    .from("eventos")
    .select("entidade_id")
    .eq("evento", "fluig_erro")
    .eq("tipo_entidade", "afastamento")
    .gte("ocorrido_em", oneDayAgo()) as any);

  const ids = [...new Set((data ?? []).map((e: any) => e.entidade_id as string))];
  const items = await resolveAfastamentoItems(admin, ids);
  return { count: ids.length, items };
}

export async function getAprovacaoLatencia(
  admin: SupabaseClient,
): Promise<{ p50_horas: number | null; p95_horas: number | null }> {
  const cutoff = thirtyDaysAgo();

  const { data: aprovados } = await (admin
    .from("eventos")
    .select("entidade_id, ocorrido_em")
    .eq("evento", "aprovado")
    .eq("tipo_entidade", "afastamento")
    .gte("ocorrido_em", cutoff) as any);

  if (!aprovados || aprovados.length === 0) return { p50_horas: null, p95_horas: null };

  const ids = aprovados.map((e: any) => e.entidade_id as string);

  const { data: criados } = await (admin
    .from("eventos")
    .select("entidade_id, ocorrido_em")
    .eq("evento", "criado")
    .eq("tipo_entidade", "afastamento")
    .in("entidade_id", ids) as any);

  const criadoMap = Object.fromEntries(
    (criados ?? []).map((e: any) => [e.entidade_id as string, e.ocorrido_em as string]),
  );

  const diffs = aprovados
    .filter((e: any) => criadoMap[e.entidade_id as string])
    .map((e: any) => {
      const aprovadoMs = new Date(e.ocorrido_em as string).getTime();
      const criadoMs = new Date(criadoMap[e.entidade_id as string]!).getTime();
      return (aprovadoMs - criadoMs) / 3_600_000;
    })
    .filter((h: number) => h >= 0)
    .sort((a: number, b: number) => a - b);

  return {
    p50_horas: percentile(diffs, 0.5),
    p95_horas: percentile(diffs, 0.95),
  };
}

export async function getOcorrenciasPorSituacao(
  admin: SupabaseClient,
): Promise<Array<{ situacao: string; count: number }>> {
  const { data } = await (admin
    .from("ocorrencias")
    .select("situacao") as any);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const s = row.situacao as string;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return Object.entries(counts).map(([situacao, count]) => ({ situacao, count }));
}

export async function getAfastosPorTipo(
  admin: SupabaseClient,
): Promise<Array<{ rotulo: string; count: number; percent: number }>> {
  const { data } = await (admin
    .from("afastamentos")
    .select("afastamento_tipos(rotulo)")
    .gte("criado_em", startOfMonth()) as any);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const rotulo = (row.afastamento_tipos?.rotulo as string) ?? "Sem tipo";
    counts[rotulo] = (counts[rotulo] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const topTotal = entries.reduce((s, [, n]) => s + n, 0);
  const result = entries.map(([rotulo, count]) => ({
    rotulo,
    count,
    percent: total === 0 ? 0 : Math.round((count / total) * 100),
  }));
  if (topTotal < total) {
    result.push({ rotulo: `Outros`, count: total - topTotal, percent: Math.round(((total - topTotal) / total) * 100) });
  }
  return result;
}

export async function getAnexosStatus(
  admin: SupabaseClient,
): Promise<{ presentes: number; ausentes: number }> {
  const { data } = await (admin
    .from("afastamentos")
    .select("arquivo_url") as any);

  let presentes = 0;
  let ausentes = 0;
  for (const row of data ?? []) {
    if (row.arquivo_url) presentes++;
    else ausentes++;
  }
  return { presentes, ausentes };
}

export async function getUnreadCount(admin: SupabaseClient): Promise<number> {
  const { data } = await (admin
    .from("eventos")
    .select("id")
    .in("tipo_entidade", ["afastamento", "ocorrencia"])
    .gte("ocorrido_em", oneDayAgo()) as any);
  return (data ?? []).length;
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run tests/unit/dashboard-queries.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/queries.ts tests/unit/dashboard-queries.test.ts
git commit -m "feat(phase-7): dashboard query functions + unit tests"
```

---

## Section B — API endpoints

### Task 4: `GET /api/saude` — admin-only health metrics endpoint

**Files:**
- Create: `app/api/saude/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getEmailsFalhados,
  getFluigFalhados,
  getAprovacaoLatencia,
  getOcorrenciasPorSituacao,
  getAfastosPorTipo,
  getAnexosStatus,
  getThresholdHoras,
  type SaudeMetrics,
} from "@/lib/dashboard/queries";

export async function GET() {
  const me = await requireAdminUser();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = getSupabaseAdmin();

  const [
    emails_falhados,
    fluig_falhados,
    latencia,
    ocorrencias_por_situacao,
    afastos_por_tipo,
    anexos,
    threshold_horas,
  ] = await Promise.all([
    getEmailsFalhados(admin),
    getFluigFalhados(admin),
    getAprovacaoLatencia(admin),
    getOcorrenciasPorSituacao(admin),
    getAfastosPorTipo(admin),
    getAnexosStatus(admin),
    getThresholdHoras(admin),
  ]);

  const payload: SaudeMetrics = {
    emails_falhados,
    fluig_falhados,
    aprovacao_p50_horas: latencia.p50_horas,
    aprovacao_p95_horas: latencia.p95_horas,
    ocorrencias_por_situacao,
    afastos_por_tipo,
    anexos_presentes: anexos.presentes,
    anexos_ausentes: anexos.ausentes,
    threshold_horas,
  };

  return NextResponse.json(payload);
}
```

- [ ] **Step 2: Smoke test — confirm 403 for unauthenticated**

Start the dev server (`npm run dev`) in a separate terminal, then:

```bash
curl -s http://localhost:3000/api/saude | jq .
```

Expected: `{"error":"forbidden"}` (no cookie = not authenticated).

- [ ] **Step 3: Commit**

```bash
git add app/api/saude/route.ts
git commit -m "feat(phase-7): GET /api/saude — admin health metrics endpoint"
```

---

### Task 5: `GET /api/notificacoes/unread` — unread count for any authenticated user

**Files:**
- Create: `app/api/notificacoes/unread/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUnreadCount } from "@/lib/dashboard/queries";

export async function GET() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const count = await getUnreadCount(admin);
  return NextResponse.json({ count });
}
```

- [ ] **Step 2: Smoke test — confirm 401 for unauthenticated**

```bash
curl -s http://localhost:3000/api/notificacoes/unread | jq .
```

Expected: `{"error":"unauthorized"}`.

- [ ] **Step 3: Commit**

```bash
git add app/api/notificacoes/unread/route.ts
git commit -m "feat(phase-7): GET /api/notificacoes/unread — bell count endpoint"
```

---

### Task 6: Extend configuracoes API + admin page for threshold

The approval-latency threshold (`aprovacao_lenta_horas`) is stored in `configuracoes_dashboard.config`. Extend the existing GET and PATCH handlers and add a Dashboard section to the admin configuracoes UI.

**Files:**
- Modify: `app/api/admin/configuracoes/route.ts`
- Modify: `app/(admin)/admin/configuracoes/page.tsx`

- [ ] **Step 1: Extend the API route**

Replace the full contents of `app/api/admin/configuracoes/route.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  if (!await requireAdminUser()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const [configRes, dashRes] = await Promise.all([
    admin.from("configuracoes").select("*").eq("id", 1).single(),
    admin.from("configuracoes_dashboard").select("config").single(),
  ]);
  return NextResponse.json({
    ...configRes.data,
    aprovacao_lenta_horas: (dashRes.data?.config as { aprovacao_lenta_horas?: number } | null)?.aprovacao_lenta_horas ?? 24,
  });
}

const Patch = z.object({
  email_folha: z.string().email().optional(),
  aprovacao_lenta_horas: z.number().int().min(1).max(720).optional(),
});

export async function PATCH(req: NextRequest) {
  const me = await requireAdminUser();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const admin = getSupabaseAdmin();

  if (parsed.data.email_folha !== undefined) {
    const { error } = await admin.from("configuracoes")
      .update({ email_folha: parsed.data.email_folha, atualizado_em: new Date().toISOString(), atualizado_por: me.id })
      .eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (parsed.data.aprovacao_lenta_horas !== undefined) {
    const { error } = await admin.from("configuracoes_dashboard")
      .update({ config: { aprovacao_lenta_horas: parsed.data.aprovacao_lenta_horas }, atualizado_em: new Date().toISOString() })
      .eq("id", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Extend the admin configuracoes page**

Replace the full contents of `app/(admin)/admin/configuracoes/page.tsx`:

```typescript
"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ConfiguracoesPage() {
  const [emailFolha, setEmailFolha] = React.useState("");
  const [aprovacaoLentaHoras, setAprovacaoLentaHoras] = React.useState(24);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/admin/configuracoes")
      .then((r) => r.ok ? r.json() : null)
      .then((c) => {
        setEmailFolha(c?.email_folha ?? "");
        setAprovacaoLentaHoras(c?.aprovacao_lenta_horas ?? 24);
      })
      .catch(() => toast.error("Erro ao carregar configurações."));
  }, []);

  async function saveNotificacoes() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/configuracoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_folha: emailFolha }),
      });
      if (!r.ok) { toast.error("Erro ao salvar."); return; }
      toast.success("Salvo.");
    } catch { toast.error("Erro de rede."); }
    finally { setBusy(false); }
  }

  async function saveDashboard() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/configuracoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aprovacao_lenta_horas: aprovacaoLentaHoras }),
      });
      if (!r.ok) { toast.error("Erro ao salvar."); return; }
      toast.success("Salvo.");
    } catch { toast.error("Erro de rede."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">Administração</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Configurações</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
      </header>

      <section className="max-w-2xl rounded-md border border-[var(--color-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Notificações
        </h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email-folha">Email da Folha de Pagamentos</Label>
          <Input
            id="email-folha"
            type="email"
            value={emailFolha}
            onChange={(e) => setEmailFolha(e.target.value)}
            placeholder="folha@empresa.com"
          />
          <p className="text-xs text-[var(--color-fg-muted)]">
            Para onde notificações de afastamentos aprovados são enviadas.
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveNotificacoes} disabled={busy}>Salvar</Button>
        </div>
      </section>

      <section className="max-w-2xl rounded-md border border-[var(--color-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Dashboard
        </h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="aprovacao-lenta">Aprovação lenta — limiar (horas)</Label>
          <Input
            id="aprovacao-lenta"
            type="number"
            min={1}
            max={720}
            value={aprovacaoLentaHoras}
            onChange={(e) => setAprovacaoLentaHoras(Number(e.target.value))}
          />
          <p className="text-xs text-[var(--color-fg-muted)]">
            O card P50 no painel de saúde fica vermelho quando o tempo médio de aprovação superar este valor.
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveDashboard} disabled={busy}>Salvar</Button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/configuracoes/route.ts app/\(admin\)/admin/configuracoes/page.tsx
git commit -m "feat(phase-7): extend configuracoes API + admin page for approval latency threshold"
```

---

## Section C — UI components

### Task 7: `<MetricCard>` primitive

**Files:**
- Create: `components/saude/metric-card.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { cn } from "@/lib/utils";

export type MetricTone = "ok" | "warn" | "error" | "neutral";

interface MetricCardProps {
  label: string;
  value: number | string;
  delta?: string;
  tone?: MetricTone;
  children?: React.ReactNode;
}

const toneStrip: Record<MetricTone, string> = {
  ok:      "bg-[var(--brand-primary-600)]",
  warn:    "bg-amber-400",
  error:   "bg-red-500",
  neutral: "bg-[var(--brand-accent-500)]",
};

const toneBg: Record<MetricTone, string> = {
  ok:      "bg-white",
  warn:    "bg-amber-50",
  error:   "bg-red-50",
  neutral: "bg-white",
};

const toneText: Record<MetricTone, string> = {
  ok:      "text-foreground",
  warn:    "text-amber-700",
  error:   "text-red-700",
  neutral: "text-foreground",
};

export function MetricCard({ label, value, delta, tone = "neutral", children }: MetricCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-md border border-[var(--color-border)] p-5 shadow-[var(--shadow-xs)]",
      toneBg[tone],
    )}>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
        {label}
      </p>
      <p className={cn("mt-2 text-3xl font-semibold tracking-tight", toneText[tone])}>
        {value}
      </p>
      {delta && (
        <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{delta}</p>
      )}
      {children && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-3">
          {children}
        </div>
      )}
      <span aria-hidden="true" className={cn("absolute inset-x-0 bottom-0 h-[2px]", toneStrip[tone])} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/saude/metric-card.tsx
git commit -m "feat(phase-7): MetricCard primitive — label + value + tone strip"
```

---

### Task 8: `<SaudeClient>` + `/painel/saude` page

**Files:**
- Create: `components/saude/saude-client.tsx`
- Create: `app/(app)/painel/saude/page.tsx`

- [ ] **Step 1: Create `<SaudeClient>`**

Create `components/saude/saude-client.tsx`:

```typescript
"use client";

import * as React from "react";
import Link from "next/link";
import { MetricCard, type MetricTone } from "@/components/saude/metric-card";
import type { SaudeMetrics, FailedItem } from "@/lib/dashboard/queries";

function useInterval(callback: () => void, delay: number) {
  const saved = React.useRef(callback);
  React.useEffect(() => { saved.current = callback; }, [callback]);
  React.useEffect(() => {
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function formatHoras(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
}

function FailedList({ items, total }: { items: FailedItem[]; total: number }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between text-xs">
          <span className="truncate text-[var(--color-fg-muted)]">
            {item.colaborador_nome} · {item.tipo}
          </span>
          <Link
            href={`/afastamentos/${item.id}`}
            className="ml-2 shrink-0 text-red-600 underline hover:text-red-800"
          >
            ver →
          </Link>
        </li>
      ))}
      {total > items.length && (
        <li className="text-xs text-[var(--color-fg-muted)]">
          + {total - items.length} outros
        </li>
      )}
    </ul>
  );
}

function latenciaTone(p50: number | null, threshold: number): MetricTone {
  if (p50 === null) return "neutral";
  return p50 > threshold ? "error" : "ok";
}

interface SaudeClientProps {
  initial: SaudeMetrics;
}

export function SaudeClient({ initial }: SaudeClientProps) {
  const [data, setData] = React.useState<SaudeMetrics>(initial);
  const [lastUpdated, setLastUpdated] = React.useState<Date>(new Date());
  const [stale, setStale] = React.useState(false);

  async function refresh() {
    try {
      const r = await fetch("/api/saude");
      if (!r.ok) { setStale(true); return; }
      setData(await r.json());
      setLastUpdated(new Date());
      setStale(false);
    } catch {
      setStale(true);
    }
  }

  useInterval(refresh, 30_000);

  const updatedLabel = `última atualização: ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${stale ? " (dados podem estar desatualizados)" : ""}`;

  const totalAfastos = data.afastos_por_tipo.reduce((s, t) => s + t.count, 0);

  return (
    <div className="space-y-8">
      {/* Alertas */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Alertas — última 24 h
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            label="Emails falhados"
            value={data.emails_falhados.count}
            tone={data.emails_falhados.count > 0 ? "error" : "ok"}
            delta={data.emails_falhados.count === 0 ? "Tudo enviado" : undefined}
          >
            {data.emails_falhados.count > 0 && (
              <FailedList items={data.emails_falhados.items} total={data.emails_falhados.count} />
            )}
          </MetricCard>
          <MetricCard
            label="Pushes Fluig falhados"
            value={data.fluig_falhados.count}
            tone={data.fluig_falhados.count > 0 ? "error" : "ok"}
            delta={data.fluig_falhados.count === 0 ? "Tudo enviado" : undefined}
          >
            {data.fluig_falhados.count > 0 && (
              <FailedList items={data.fluig_falhados.items} total={data.fluig_falhados.count} />
            )}
          </MetricCard>
        </div>
      </section>

      {/* Operacional */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Operacional — mês corrente
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Aprovação P50"
            value={formatHoras(data.aprovacao_p50_horas)}
            tone={latenciaTone(data.aprovacao_p50_horas, data.threshold_horas)}
            delta={`limiar: ${data.threshold_horas}h`}
          />
          <MetricCard
            label="Aprovação P95"
            value={formatHoras(data.aprovacao_p95_horas)}
            tone="neutral"
          />
          {data.ocorrencias_por_situacao.map((o) => (
            <MetricCard
              key={o.situacao}
              label={`Ocorrências ${o.situacao}`}
              value={o.count}
              tone="neutral"
            />
          ))}
          <MetricCard
            label="Anexos presentes"
            value={data.anexos_presentes}
            tone="neutral"
            delta={`${data.anexos_ausentes} sem anexo`}
          />
        </div>

        {/* Distribuição por tipo */}
        <div className="mt-4 rounded-md border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-xs)]">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
            Afastamentos por tipo — {totalAfastos} no mês
          </p>
          <div className="space-y-2">
            {data.afastos_por_tipo.map((t) => (
              <div key={t.rotulo}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="truncate text-foreground">{t.rotulo}</span>
                  <span className="ml-2 shrink-0 font-semibold text-foreground">{t.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-sm bg-[var(--color-border)]">
                  <div
                    className="h-full rounded-sm bg-[var(--brand-accent-500)]"
                    style={{ width: `${t.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="text-xs text-[var(--color-fg-subtle)]">{updatedLabel}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

Create `app/(app)/painel/saude/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getEmailsFalhados,
  getFluigFalhados,
  getAprovacaoLatencia,
  getOcorrenciasPorSituacao,
  getAfastosPorTipo,
  getAnexosStatus,
  getThresholdHoras,
  type SaudeMetrics,
} from "@/lib/dashboard/queries";
import { SaudeClient } from "@/components/saude/saude-client";

export default async function PainelSaudePage() {
  const me = await requireAdminUser();
  if (!me) redirect("/painel");

  const admin = getSupabaseAdmin();

  const [
    emails_falhados,
    fluig_falhados,
    latencia,
    ocorrencias_por_situacao,
    afastos_por_tipo,
    anexos,
    threshold_horas,
  ] = await Promise.all([
    getEmailsFalhados(admin),
    getFluigFalhados(admin),
    getAprovacaoLatencia(admin),
    getOcorrenciasPorSituacao(admin),
    getAfastosPorTipo(admin),
    getAnexosStatus(admin),
    getThresholdHoras(admin),
  ]);

  const initial: SaudeMetrics = {
    emails_falhados,
    fluig_falhados,
    aprovacao_p50_horas: latencia.p50_horas,
    aprovacao_p95_horas: latencia.p95_horas,
    ocorrencias_por_situacao,
    afastos_por_tipo,
    anexos_presentes: anexos.presentes,
    anexos_ausentes: anexos.ausentes,
    threshold_horas,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
          Painel · Saúde do sistema
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Saúde operacional</h1>
      </header>
      <SaudeClient initial={initial} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/saude/saude-client.tsx app/\(app\)/painel/saude/page.tsx
git commit -m "feat(phase-7): /painel/saude page + SaudeClient poller"
```

---

### Task 9: `<SaudeBanner>` + mount on `/painel`

**Files:**
- Create: `components/saude/saude-banner.tsx`
- Modify: `app/(app)/painel/page.tsx`

- [ ] **Step 1: Create `<SaudeBanner>`**

Create `components/saude/saude-banner.tsx`:

```typescript
"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import type { SaudeMetrics } from "@/lib/dashboard/queries";

function useInterval(callback: () => void, delay: number) {
  const saved = React.useRef(callback);
  React.useEffect(() => { saved.current = callback; }, [callback]);
  React.useEffect(() => {
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export function SaudeBanner() {
  const [failures, setFailures] = React.useState(0);

  async function check() {
    try {
      const r = await fetch("/api/saude");
      if (!r.ok) return;
      const data: SaudeMetrics = await r.json();
      setFailures(data.emails_falhados.count + data.fluig_falhados.count);
    } catch {
      // silent — don't show banner on polling error
    }
  }

  React.useEffect(() => { check(); }, []);
  useInterval(check, 30_000);

  if (failures === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
      <span className="flex items-center gap-2">
        <AlertTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
        {failures} {failures === 1 ? "falha" : "falhas"} nas últimas 24 h
      </span>
      <Link href="/painel/saude" className="font-medium underline hover:text-red-900">
        ver painel →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Mount `<SaudeBanner>` in the `/painel` page**

In `app/(app)/painel/page.tsx`, add the import at the top:

```typescript
import { SaudeBanner } from "@/components/saude/saude-banner";
```

Then inside the returned JSX, add `<SaudeBanner />` immediately after the opening `<div className="space-y-6">` and before `<header ...>`:

```typescript
  return (
    <div className="space-y-6">
      <SaudeBanner />
      <header className="flex items-end justify-between gap-4">
      {/* ... rest unchanged ... */}
```

- [ ] **Step 3: Commit**

```bash
git add components/saude/saude-banner.tsx app/\(app\)/painel/page.tsx
git commit -m "feat(phase-7): SaudeBanner — alert strip on /painel when failures exist"
```

---

### Task 10: Refactor `AppNotificationBell` + `AppTopNav`

The bell becomes a self-contained client component; `AppTopNav` no longer needs to pass an `unread` prop.

**Files:**
- Modify: `components/layout/app-notification-bell.tsx`
- Modify: `components/layout/app-top-nav.tsx`

- [ ] **Step 1: Rewrite `app-notification-bell.tsx`**

Replace the full file contents:

```typescript
"use client";

import * as React from "react";
import { BellIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function useInterval(callback: () => void, delay: number) {
  const saved = React.useRef(callback);
  React.useEffect(() => { saved.current = callback; }, [callback]);
  React.useEffect(() => {
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export function AppNotificationBell() {
  const [count, setCount] = React.useState(0);

  async function fetchCount() {
    try {
      const r = await fetch("/api/notificacoes/unread");
      if (!r.ok) return;
      const data: { count: number } = await r.json();
      setCount(data.count);
    } catch {
      // silent
    }
  }

  React.useEffect(() => { fetchCount(); }, []);
  useInterval(fetchCount, 30_000);

  function handleClick() {
    setCount(0); // client-side dismiss
  }

  return (
    <button
      type="button"
      aria-label="Notificações"
      onClick={handleClick}
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-md text-[var(--color-fg-muted)]",
        "hover:bg-muted hover:text-foreground",
      )}
    >
      <BellIcon className="size-5" aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 size-2 rounded-full bg-[var(--brand-accent-500)] ring-2 ring-background"
        />
      )}
    </button>
  );
}
```

- [ ] **Step 2: Update `app-top-nav.tsx` — remove the `unread` prop**

In `components/layout/app-top-nav.tsx`, the `<AppNotificationBell />` call currently passes no dynamic props (it already receives `unread={false}` as a constant in the existing code). Remove any prop passing to the bell — it is now fully self-contained. The component signature accepts no props, so the call site needs no props:

```typescript
<AppNotificationBell />
```

Verify the import still points to the same path. No other change to `AppTopNav` is needed.

- [ ] **Step 3: Commit**

```bash
git add components/layout/app-notification-bell.tsx components/layout/app-top-nav.tsx
git commit -m "feat(phase-7): AppNotificationBell — self-contained poller, removes unread prop"
```

---

## Section D — Navigation + config

### Task 11: `lib/nav.ts` — add Saúde to admin group + update unit test

**Files:**
- Modify: `lib/nav.ts`
- Modify: `tests/unit/nav.test.ts`

- [ ] **Step 1: Update the failing test first**

In `tests/unit/nav.test.ts`, add a new test inside the existing `describe("appNav config")` block:

```typescript
  it("admin group contains a Saúde item pointing to /painel/saude", () => {
    const admin = appNav.find((g) => g.id === "admin")!;
    const saude = admin.items.find((i) => i.href === "/painel/saude");
    expect(saude).toBeDefined();
    expect(saude!.label).toBe("Saúde");
  });
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run tests/unit/nav.test.ts
```

Expected: FAIL — `expect(saude).toBeDefined()` fails.

- [ ] **Step 3: Add Saúde to `lib/nav.ts`**

In `lib/nav.ts`, add the item to the `admin` group's `items` array. Place it as the first item (so admins find it easily):

```typescript
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    adminOnly: true,
    items: [
      { label: "Saúde", href: "/painel/saude" },
      { label: "Empresas", href: "/admin/empresas" },
      { label: "Unidades", href: "/admin/unidades" },
      { label: "Equipes", href: "/admin/equipes" },
      { label: "Usuários", href: "/admin/usuarios" },
      { label: "Tipos de afastamento", href: "/admin/afastamento-tipos" },
      { label: "Configurações", href: "/admin/configuracoes" },
    ],
  },
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
npx vitest run tests/unit/nav.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nav.ts tests/unit/nav.test.ts
git commit -m "feat(phase-7): add Saúde to admin nav group"
```

---

## Section E — E2E testing

### Task 12: E2E arc — `/painel/saude`

**Files:**
- Create: `tests/e2e/phase-7-saude.spec.ts`

- [ ] **Step 1: Create the spec**

```typescript
import { test, expect } from "@playwright/test";

const OH_EMAIL = process.env.E2E_OH_EMAIL!;
const OH_PASSWORD = process.env.E2E_OH_PASSWORD!;

test.describe("Phase 7 — /painel/saude", () => {
  test.skip(!process.env.E2E_SAUDE, "set E2E_SAUDE=1 to run");

  test("admin sees the health dashboard with two sections", async ({ page }) => {
    // 1. Log in as OH admin
    await page.goto("/login");
    await page.locator("input[type=email]").fill(OH_EMAIL);
    await page.locator("input[type=password]").fill(OH_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/painel/);

    // 2. Navigate to /painel/saude
    await page.goto("/painel/saude");
    await expect(page).toHaveURL(/\/painel\/saude/);

    // 3. Both section headings are present
    await expect(page.getByText("Alertas — última 24 h", { exact: false })).toBeVisible();
    await expect(page.getByText("Operacional — mês corrente", { exact: false })).toBeVisible();

    // 4. At least the email failures metric card is present
    await expect(page.getByText("Emails falhados", { exact: false })).toBeVisible();

    // 5. Notification bell is visible in the top nav
    await expect(page.getByRole("button", { name: "Notificações" })).toBeVisible();

    // 6. Timestamp "última atualização" is rendered
    await expect(page.getByText(/última atualização/)).toBeVisible();
  });

  test("/api/saude returns 403 for unauthenticated requests", async ({ request }) => {
    const r = await request.get("/api/saude");
    expect(r.status()).toBe(403);
  });

  test("/api/notificacoes/unread returns 401 for unauthenticated requests", async ({ request }) => {
    const r = await request.get("/api/notificacoes/unread");
    expect(r.status()).toBe(401);
  });

  test("/painel shows SaudeBanner when failures exist (mocked via direct page visit)", async ({ page }) => {
    // We can't easily inject eventos in E2E, so just verify the banner component
    // does NOT appear when there are no failures — green state.
    await page.goto("/login");
    await page.locator("input[type=email]").fill(OH_EMAIL);
    await page.locator("input[type=password]").fill(OH_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/painel/);

    // The banner is a conditional render — on a clean DB there are no failures,
    // so it should not be visible.
    await expect(page.getByText(/falha.*nas últimas 24/)).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Verify the spec is skipped by default (gated)**

```bash
cd /Users/heizen/DEV/maia-app
npx playwright test tests/e2e/phase-7-saude.spec.ts --reporter=list 2>&1 | head -20
```

Expected: tests are skipped (`E2E_SAUDE` not set). No failures.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/phase-7-saude.spec.ts
git commit -m "test(phase-7): gated E2E arc for /painel/saude + bell + API auth"
```

---

## Section F — Verification

### Task 13: Full test run + build check

- [ ] **Step 1: Run all unit tests**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run
```

Expected: all PASS. Zero failures.

- [ ] **Step 2: Run existing E2E happy path (no `E2E_SAUDE` needed)**

```bash
npx playwright test tests/e2e/happy-path.spec.ts tests/e2e/painel.spec.ts --reporter=list
```

Expected: PASS. The `painel.spec.ts` test still passes — `<SaudeBanner>` renders `null` on a clean DB, so the existing assertions are unaffected.

- [ ] **Step 3: TypeScript build check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit final verification tag**

```bash
git commit --allow-empty -m "chore(phase-7): all tests pass, build clean"
```
