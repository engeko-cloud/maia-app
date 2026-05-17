# Painel Role-Differentiated Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Differentiate the painel hero, quick-action card colours, and KPI cards per role (admin / oh / safety), and introduce consistent orange-when-actionable / blue-when-clear colour semantics.

**Architecture:** Extract hero content derivation into a pure `buildHeroContent` function (unit-testable). Update `PainelHero` to accept multiple CTAs. Fetch two new safety KPIs (`ocorrencias_mes`, `investigacoes_pendentes`) in the page and thread new counts through to hero, quick-action tones, and KPI cards.

**Tech Stack:** Next.js App Router (RSC), Supabase client, Vitest, Tailwind/CSS vars, Lucide icons.

---

## File Map

| Action | Path | What changes |
|---|---|---|
| Modify | `components/painel/painel-hero.tsx` | Replace `cta` prop with `ctas` array |
| Create | `lib/painel-hero-content.ts` | Pure `buildHeroContent` function |
| Create | `tests/unit/painel-hero-content.test.ts` | Vitest unit tests for the above |
| Modify | `app/app/painel/page.tsx` | New queries + wire updated props |

---

## Task 1: Update `PainelHero` to accept multiple CTAs

**Files:**
- Modify: `components/painel/painel-hero.tsx`

- [ ] **Step 1: Replace the `cta` prop with `ctas` array**

Replace the full file content with:

```tsx
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

interface HeroCta {
  href: string;
  label: string;
}

interface PainelHeroProps {
  headline: string;
  sub: string;
  ctas?: HeroCta[];
}

export function PainelHero({ headline, sub, ctas }: PainelHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-primary-600)] to-[var(--brand-primary-900)] p-6 text-white sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at top right, color-mix(in oklab, var(--brand-accent-500) 30%, transparent), transparent 60%)",
        }}
      />
      <div className="relative">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{headline}</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">{sub}</p>
        {ctas && ctas.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {ctas.map((cta) => (
              <Link
                key={cta.href}
                href={cta.href}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-accent-500)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-accent-600)]"
              >
                {cta.label}
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </div>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--brand-accent-500)]"
      />
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep painel-hero
```

Expected: no output for `painel-hero.tsx` itself. Note: `page.tsx` will show one error for the now-removed `cta` prop — that is expected and resolved in Task 3.

- [ ] **Step 3: Commit**

```bash
git add components/painel/painel-hero.tsx
git commit -m "feat(painel): support multiple CTAs in PainelHero"
```

---

## Task 2: Extract and test `buildHeroContent`

The page needs different hero text/CTAs depending on whether the user is admin, OH-only, or safety-only. Extract this into a pure function so it can be unit-tested without mocking Supabase or Next.js.

**Files:**
- Create: `lib/painel-hero-content.ts`
- Create: `tests/unit/painel-hero-content.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `tests/unit/painel-hero-content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildHeroContent } from "@/lib/painel-hero-content";

describe("buildHeroContent", () => {
  // ── admin ──────────────────────────────────────────────────────────────
  describe("admin (both pendentes and investigacoesPendentes > 0)", () => {
    it("shows combined headline with two CTAs", () => {
      const result = buildHeroContent({
        isAdmin: true, showOh: true, showSafety: true,
        pendentes: 3, investigacoesPendentes: 2,
      });
      expect(result.headline).toBe("3 aprovações e 2 investigações aguardando revisão.");
      expect(result.ctas).toHaveLength(2);
      expect(result.ctas[0].href).toBe("/app/afastamentos/aprovacoes");
      expect(result.ctas[1].href).toBe("/app/investigacoes");
    });

    it("uses singular 'aprovação' when pendentes === 1", () => {
      const result = buildHeroContent({
        isAdmin: true, showOh: true, showSafety: true,
        pendentes: 1, investigacoesPendentes: 2,
      });
      expect(result.headline).toContain("1 aprovação");
    });

    it("uses singular 'investigação' when investigacoesPendentes === 1", () => {
      const result = buildHeroContent({
        isAdmin: true, showOh: true, showSafety: true,
        pendentes: 2, investigacoesPendentes: 1,
      });
      expect(result.headline).toContain("1 investigação");
    });
  });

  describe("admin (only pendentes > 0)", () => {
    it("shows OH headline with one CTA", () => {
      const result = buildHeroContent({
        isAdmin: true, showOh: true, showSafety: true,
        pendentes: 3, investigacoesPendentes: 0,
      });
      expect(result.headline).toBe("3 aprovações aguardando sua revisão.");
      expect(result.ctas).toHaveLength(1);
      expect(result.ctas[0].href).toBe("/app/afastamentos/aprovacoes");
    });
  });

  describe("admin (only investigacoesPendentes > 0)", () => {
    it("shows safety headline with one CTA", () => {
      const result = buildHeroContent({
        isAdmin: true, showOh: true, showSafety: true,
        pendentes: 0, investigacoesPendentes: 4,
      });
      expect(result.headline).toBe("4 investigações aguardando conclusão.");
      expect(result.ctas).toHaveLength(1);
      expect(result.ctas[0].href).toBe("/app/investigacoes");
    });
  });

  describe("admin (all clear)", () => {
    it("shows all-clear headline with no CTAs", () => {
      const result = buildHeroContent({
        isAdmin: true, showOh: true, showSafety: true,
        pendentes: 0, investigacoesPendentes: 0,
      });
      expect(result.headline).toBe("Nada pendente — tudo em dia.");
      expect(result.ctas).toHaveLength(0);
    });
  });

  // ── OH only ────────────────────────────────────────────────────────────
  describe("OH-only user (pendentes > 0)", () => {
    it("shows OH headline with aprovações CTA", () => {
      const result = buildHeroContent({
        isAdmin: false, showOh: true, showSafety: false,
        pendentes: 2, investigacoesPendentes: 0,
      });
      expect(result.headline).toBe("2 aprovações aguardando sua revisão.");
      expect(result.ctas).toHaveLength(1);
      expect(result.ctas[0].href).toBe("/app/afastamentos/aprovacoes");
    });
  });

  describe("OH-only user (all clear)", () => {
    it("shows all-clear headline", () => {
      const result = buildHeroContent({
        isAdmin: false, showOh: true, showSafety: false,
        pendentes: 0, investigacoesPendentes: 0,
      });
      expect(result.headline).toBe("Nada pendente — tudo em dia.");
      expect(result.ctas).toHaveLength(0);
    });
  });

  // ── Safety only ────────────────────────────────────────────────────────
  describe("safety-only user (investigacoesPendentes > 0)", () => {
    it("shows safety headline with investigações CTA", () => {
      const result = buildHeroContent({
        isAdmin: false, showOh: false, showSafety: true,
        pendentes: 0, investigacoesPendentes: 3,
      });
      expect(result.headline).toBe("3 investigações aguardando conclusão.");
      expect(result.ctas).toHaveLength(1);
      expect(result.ctas[0].href).toBe("/app/investigacoes");
    });
  });

  describe("safety-only user (all clear)", () => {
    it("shows all-clear headline", () => {
      const result = buildHeroContent({
        isAdmin: false, showOh: false, showSafety: true,
        pendentes: 0, investigacoesPendentes: 0,
      });
      expect(result.headline).toBe("Nada pendente — tudo em dia.");
      expect(result.ctas).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/painel-hero-content.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/painel-hero-content'"

- [ ] **Step 3: Implement `buildHeroContent`**

Create `lib/painel-hero-content.ts`:

```ts
export interface HeroCta {
  href: string;
  label: string;
}

export interface HeroContent {
  headline: string;
  sub: string;
  ctas: HeroCta[];
}

interface BuildHeroContentOpts {
  isAdmin: boolean;
  showOh: boolean;
  showSafety: boolean;
  pendentes: number;
  investigacoesPendentes: number;
}

const pluralAprovacoes = (n: number) =>
  n === 1 ? "1 aprovação" : `${n} aprovações`;

const pluralInvestigacoes = (n: number) =>
  n === 1 ? "1 investigação" : `${n} investigações`;

const ALL_CLEAR: HeroContent = {
  headline: "Nada pendente — tudo em dia.",
  sub: "Acompanhe os registros ativos pelos cartões abaixo.",
  ctas: [],
};

export function buildHeroContent({
  isAdmin,
  showOh,
  showSafety,
  pendentes,
  investigacoesPendentes,
}: BuildHeroContentOpts): HeroContent {
  const combined = isAdmin || (showOh && showSafety);

  if (combined) {
    const hasPendentes = pendentes > 0;
    const hasInv = investigacoesPendentes > 0;

    if (hasPendentes && hasInv) {
      return {
        headline: `${pluralAprovacoes(pendentes)} e ${pluralInvestigacoes(investigacoesPendentes)} aguardando revisão.`,
        sub: "Revise as aprovações e investigações pendentes para manter o fluxo.",
        ctas: [
          { href: "/app/afastamentos/aprovacoes", label: "Ver aprovações" },
          { href: "/app/investigacoes", label: "Ver investigações" },
        ],
      };
    }
    if (hasPendentes) {
      return {
        headline: `${pluralAprovacoes(pendentes)} aguardando sua revisão.`,
        sub: "Revise as solicitações pendentes antes do fim do dia para manter o fluxo.",
        ctas: [{ href: "/app/afastamentos/aprovacoes", label: "Ver aprovações" }],
      };
    }
    if (hasInv) {
      return {
        headline: `${pluralInvestigacoes(investigacoesPendentes)} aguardando conclusão.`,
        sub: "Acesse as investigações abertas e conclua as pendentes.",
        ctas: [{ href: "/app/investigacoes", label: "Ver investigações" }],
      };
    }
    return ALL_CLEAR;
  }

  if (showOh) {
    if (pendentes > 0) {
      return {
        headline: `${pluralAprovacoes(pendentes)} aguardando sua revisão.`,
        sub: "Revise as solicitações pendentes antes do fim do dia para manter o fluxo.",
        ctas: [{ href: "/app/afastamentos/aprovacoes", label: "Ver aprovações" }],
      };
    }
    return ALL_CLEAR;
  }

  if (showSafety) {
    if (investigacoesPendentes > 0) {
      return {
        headline: `${pluralInvestigacoes(investigacoesPendentes)} aguardando conclusão.`,
        sub: "Acesse as investigações abertas e conclua as pendentes.",
        ctas: [{ href: "/app/investigacoes", label: "Ver investigações" }],
      };
    }
    return ALL_CLEAR;
  }

  return ALL_CLEAR;
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npx vitest run tests/unit/painel-hero-content.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/painel-hero-content.ts tests/unit/painel-hero-content.test.ts
git commit -m "feat(painel): add buildHeroContent pure function with unit tests"
```

---

## Task 3: Update `painel/page.tsx` — new data queries + wire everything

**Files:**
- Modify: `app/app/painel/page.tsx`

This task adds two new Supabase queries (`ocorrenciasMes`, `investigacoesPendentes`), imports `isAdmin` and `buildHeroContent`, and rewires the hero, quick-action tones, and KPI cards in one coordinated change.

- [ ] **Step 1: Replace the full file with the updated version**

```tsx
import {
  CheckCircle2Icon,
  FileEditIcon,
  ListChecksIcon,
  AlertTriangleIcon,
  SearchIcon,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { isAdmin, isInEquipe } from "@/lib/permissions";
import { greetingFor } from "@/lib/greeting";
import { buildHeroContent } from "@/lib/painel-hero-content";
import { PainelHero } from "@/components/painel/painel-hero";
import { QuickAction } from "@/components/painel/quick-action";
import { KpiCard } from "@/components/painel/kpi-card";
import {
  ActivityFeed,
  type ActivityFeedRow,
} from "@/components/painel/activity-feed";
import { SaudeBanner } from "@/components/saude/saude-banner";

interface EventoRow {
  id: string;
  tipo_entidade: ActivityFeedRow["tipo_entidade"];
  entidade_id: string;
  evento: ActivityFeedRow["evento"];
  ocorrido_em: string;
  usuarios: { nome: string | null; sobrenome: string | null } | null;
}

export default async function PainelPage() {
  const [me, supabase] = await Promise.all([
    getCurrentUser(),
    getSupabaseServer(),
  ]);

  const isUserAdmin = isAdmin(me);
  const showOh = isInEquipe(me, "oh");
  const showSafety = isInEquipe(me, "safety");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nome")
    .eq("id", me!.id)
    .single();
  const firstName = (usuario?.nome?.trim() || "").split(/\s+/)[0] || "Usuário";

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    pendentesRes,
    ativosRes,
    ocorrenciasAbertasRes,
    ocorrenciasMesRes,
    investigacoesPendentesRes,
    recentesRes,
  ] = await Promise.all([
    showOh
      ? supabase
          .from("afastamentos")
          .select("id", { count: "exact", head: true })
          .eq("situacao", "pendente")
      : Promise.resolve({ count: 0 }),
    showOh
      ? supabase
          .from("afastamentos")
          .select("id", { count: "exact", head: true })
          .in("situacao", ["aprovado", "em_andamento"])
      : Promise.resolve({ count: 0 }),
    showSafety
      ? supabase
          .from("ocorrencias")
          .select("id", { count: "exact", head: true })
          .eq("situacao", "aberta")
      : Promise.resolve({ count: 0 }),
    showSafety
      ? supabase
          .from("ocorrencias")
          .select("id", { count: "exact", head: true })
          .gte("criado_em", startOfMonth)
      : Promise.resolve({ count: 0 }),
    showSafety
      ? supabase
          .from("investigacoes")
          .select("id", { count: "exact", head: true })
          .in("situacao", ["em_andamento", "em_aprovacao"])
      : Promise.resolve({ count: 0 }),
    supabase
      .from("eventos")
      .select(
        "id, tipo_entidade, entidade_id, evento, ocorrido_em, usuarios:autor_id(nome, sobrenome)",
      )
      .order("ocorrido_em", { ascending: false })
      .limit(5)
      .returns<EventoRow[]>(),
  ]);

  const pendentes = pendentesRes.count ?? 0;
  const ativos = ativosRes.count ?? 0;
  const ocorrenciasAbertas = ocorrenciasAbertasRes.count ?? 0;
  const ocorrenciasMes = ocorrenciasMesRes.count ?? 0;
  const investigacoesPendentes = investigacoesPendentesRes.count ?? 0;

  const recentes: ActivityFeedRow[] = (recentesRes.data ?? []).map((row) => ({
    id: row.id,
    tipo_entidade: row.tipo_entidade,
    entidade_id: row.entidade_id,
    evento: row.evento,
    ocorrido_em: row.ocorrido_em,
    autor_nome:
      [row.usuarios?.nome, row.usuarios?.sobrenome].filter(Boolean).join(" ") ||
      null,
  }));

  const greeting = greetingFor(now.getHours());
  const formattedDate = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const hero = buildHeroContent({
    isAdmin: isUserAdmin,
    showOh,
    showSafety,
    pendentes,
    investigacoesPendentes,
  });

  const activitySeeAllHref = showOh ? "/app/afastamentos" : "/app/ocorrencias";

  return (
    <div className="space-y-6">
      <SaudeBanner />
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
            Painel
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {greeting}, {firstName}.
          </p>
        </div>
        <p className="font-mono text-xs text-[var(--color-fg-subtle)] first-letter:uppercase">
          {formattedDate}
        </p>
      </header>

      <PainelHero
        headline={hero.headline}
        sub={hero.sub}
        ctas={hero.ctas}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {showOh && (
            <>
              <QuickAction
                href="/app/afastamentos/aprovacoes"
                icon={CheckCircle2Icon}
                title="Aprovações"
                sub="Revisar afastamentos pendentes"
                tone={pendentes > 0 ? "accent" : "primary"}
                count={pendentes}
              />
              <QuickAction
                href="/app/afastamentos"
                icon={ListChecksIcon}
                title="Afastamentos"
                sub="Lista completa"
                tone="primary"
              />
            </>
          )}
          {showSafety && (
            <>
              <QuickAction
                href="/app/ocorrencias"
                icon={AlertTriangleIcon}
                title="Ocorrências"
                sub="Aberturas e investigações"
                tone={ocorrenciasAbertas > 0 ? "accent" : "primary"}
                count={ocorrenciasAbertas}
              />
              <QuickAction
                href="/app/investigacoes"
                icon={SearchIcon}
                title="Investigações"
                sub="Gerir investigações abertas"
                tone="primary"
              />
            </>
          )}
          <QuickAction
            href="/forms/ocorrencias"
            icon={AlertTriangleIcon}
            title="Nova ocorrência"
            sub="Formulário público"
            tone="primary"
          />
          {showOh && (
            <QuickAction
              href="/forms/afastamentos"
              icon={FileEditIcon}
              title="Novo afastamento"
              sub="Formulário público"
              tone="primary"
            />
          )}
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {showOh && (
              <>
                <KpiCard
                  label="Afastamentos ativos"
                  value={ativos}
                  delta={ativos === 0 ? "—" : `${ativos} em curso`}
                  tone={ativos > 0 ? "accent" : "primary"}
                />
                <KpiCard
                  label="Aprovações pendentes"
                  value={pendentes}
                  delta={pendentes === 0 ? "—" : `${pendentes} aguardando revisão`}
                  tone={pendentes > 0 ? "accent" : "primary"}
                />
              </>
            )}
            {showSafety && (
              <>
                <KpiCard
                  label="Ocorrências no mês"
                  value={ocorrenciasMes}
                  delta={ocorrenciasMes === 0 ? "—" : `${ocorrenciasMes} este mês`}
                  tone={ocorrenciasMes > 0 ? "accent" : "primary"}
                />
                <KpiCard
                  label="Investigações pendentes"
                  value={investigacoesPendentes}
                  delta={
                    investigacoesPendentes === 0
                      ? "—"
                      : `${investigacoesPendentes} aguardando conclusão`
                  }
                  tone={investigacoesPendentes > 0 ? "accent" : "primary"}
                />
              </>
            )}
          </div>
          <ActivityFeed rows={recentes} seeAllHref={activitySeeAllHref} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | grep -E "painel|hero-content"
```

Expected: no output.

- [ ] **Step 3: Run the full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: all tests PASS (including the new `painel-hero-content` suite).

- [ ] **Step 4: Start the dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:3000/app/painel` and check:

**As admin:**
- Hero shows combined headline when both pendentes > 0 and investigacoesPendentes > 0, with two CTA buttons side-by-side.
- Quick-action cards: Aprovações is orange when pendentes > 0, else blue. Ocorrências is orange when ocorrenciasAbertas > 0, else blue. All other cards are blue.
- KPI grid shows all four cards (2×2). Each card is orange when its value > 0, blue when 0.
- "Ocorrências abertas" KPI is gone — replaced by "Ocorrências no mês" and "Investigações pendentes".

**As an OH-only user (equipe = oh, administrador = false):**
- Hero shows OH headline with single "Ver aprovações" CTA (or all-clear).
- KPI grid shows only Afastamentos ativos + Aprovações pendentes.
- Quick-action grid shows only OH cards + Nova ocorrência + Novo afastamento.

**As a safety-only user (equipe = safety, administrador = false):**
- Hero shows safety headline with single "Ver investigações" CTA (or all-clear).
- KPI grid shows only Ocorrências no mês + Investigações pendentes.
- Quick-action grid shows only Ocorrências + Investigações + Nova ocorrência.

- [ ] **Step 5: Commit**

```bash
git add app/app/painel/page.tsx
git commit -m "feat(painel): role-differentiated hero, action colours, and KPI cards"
```
