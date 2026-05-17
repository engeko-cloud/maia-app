# Investigação Full Detail Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal "Iniciar investigação" card with a full read-only display of all investigation data (Ishikawa, plano de ação, participantes, fotos) on both the admin ocorrência detail page and the public status page; filter the investigações list to active-only.

**Architecture:** New shared `InvestigacaoDataView` component (extracted from the existing `InvestigacaoReport` pattern) renders all investigation data read-only. `InvestigacaoDetailSection` wraps it with the admin action bar. The existing `InvestigationStatus` and `InvestigacaoSummary` components are deleted as dead code. Tasks 1→2 must run in order; Tasks 3, 4, 5 are independent once 1+2 are done.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Tailwind CSS, Vitest.

---

## Files created / modified

| File | Change |
|---|---|
| `components/investigacoes/investigacao-data-view.tsx` | **Create** — shared read-only display: Ishikawa, plano de ação, participantes, fotos |
| `components/investigacoes/investigacao-detail-section.tsx` | **Create** — admin wrapper: InvestigacaoDataView + status-specific action bar |
| `components/investigacoes/investigation-status.tsx` | **Delete** |
| `components/investigacoes/investigacao-summary.tsx` | **Delete** |
| `app/app/ocorrencias/[id]/page.tsx` | Add categorias/graus queries; swap InvestigationStatus → InvestigacaoDetailSection |
| `app/(public)/ocorrencias/status/[token]/page.tsx` | Add investigation + categorias/graus queries; render InvestigacaoDataView |
| `app/app/investigacoes/page.tsx` | Add situacao filter; update subtitle |

---

## Task 1: Create `InvestigacaoDataView`

**Files:**
- Create: `components/investigacoes/investigacao-data-view.tsx`

- [ ] **Step 1: Verify reference patterns**

```bash
cd /Users/heizen/DEV/maia-app
grep -n "planoAcaoStatusLabel\|investigacao-dados" components/investigacoes/investigacao-report.tsx | head -5
```

Expected: lines showing the imports used by the existing report — confirms the helpers exist.

- [ ] **Step 2: Create the component**

Create `components/investigacoes/investigacao-data-view.tsx`:

```tsx
import type { InvestigacaoDados } from "@/lib/investigacao-dados";
import { planoAcaoStatusLabel } from "@/lib/investigacao-state";

interface Categoria { rotulo: string; codigo: string; }
interface Grau { rotulo: string; }

interface InvestigacaoDataViewProps {
  dados: InvestigacaoDados;
  categoriasById: Record<string, Categoria>;
  grausById: Record<string, Grau>;
  storagePublicBase: string;
}

export function InvestigacaoDataView({
  dados, categoriasById, grausById, storagePublicBase,
}: InvestigacaoDataViewProps) {
  const ishikawaFilled = dados.ishikawa.filter((b) => b.causas.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Análise Ishikawa
        </h3>
        {ishikawaFilled.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Nenhuma causa registrada.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {ishikawaFilled.map((b) => {
              const cat = categoriasById[b.categoria_id];
              const grau = b.grau_id ? grausById[b.grau_id] : null;
              return (
                <div key={b.categoria_id} className="rounded-md border border-[var(--color-border)] p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{cat?.rotulo ?? "Categoria"}</h4>
                    {grau ? (
                      <span className="rounded-md bg-[var(--color-bg-muted)] px-2 py-0.5 text-xs">
                        {grau.rotulo}
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {b.causas.map((c, i) => <li key={i}>{c.descricao}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Plano de ação
        </h3>
        {dados.plano_acao.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Nenhum item no plano de ação.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="text-left text-xs uppercase text-[var(--color-fg-muted)]">
              <tr>
                <th className="border-b border-[var(--color-border)] py-2 pr-3">Ação</th>
                <th className="border-b border-[var(--color-border)] py-2 pr-3">Responsável</th>
                <th className="border-b border-[var(--color-border)] py-2 pr-3">Prazo</th>
                <th className="border-b border-[var(--color-border)] py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {dados.plano_acao.map((a, i) => (
                <tr key={i}>
                  <td className="border-b border-[var(--color-border)] py-2 pr-3">{a.acao}</td>
                  <td className="border-b border-[var(--color-border)] py-2 pr-3">{a.responsavel}</td>
                  <td className="border-b border-[var(--color-border)] py-2 pr-3 font-mono">{a.prazo}</td>
                  <td className="border-b border-[var(--color-border)] py-2">{planoAcaoStatusLabel(a.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Participantes
        </h3>
        {dados.participantes.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Nenhum participante.</p>
        ) : (
          <ul className="text-sm">
            {dados.participantes.map((p, i) => (
              <li key={i} className="border-b border-[var(--color-border)] py-1">
                {p.nome}
                {p.email ? <span className="text-[var(--color-fg-muted)]"> · {p.email}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Fotos
        </h3>
        {dados.fotos.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Nenhuma foto.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {dados.fotos.map((f, i) => (
              <figure key={i} className="overflow-hidden rounded-md border border-[var(--color-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${storagePublicBase}${f.path}`} alt={f.legenda ?? ""} className="w-full" />
                {f.legenda ? (
                  <figcaption className="p-2 text-xs text-[var(--color-fg-muted)]">{f.legenda}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/investigacoes/investigacao-data-view.tsx
git commit -m "$(cat <<'EOF'
feat(investigacao): InvestigacaoDataView — shared read-only display component

Shows Ishikawa, plano de ação, participantes, fotos with empty states per
section. Modeled on InvestigacaoReport sections 4–7.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `InvestigacaoDetailSection`

**Files:**
- Create: `components/investigacoes/investigacao-detail-section.tsx`

Depends on Task 1 (`InvestigacaoDataView` must exist).

- [ ] **Step 1: Create the component**

Create `components/investigacoes/investigacao-detail-section.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/data/status-pill";
import { InvestigacaoDataView } from "./investigacao-data-view";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

interface Categoria { rotulo: string; codigo: string; }
interface Grau { rotulo: string; }

interface InvestigacaoDetailSectionProps {
  ocorrenciaId: string;
  investigacao: {
    situacao: "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada";
    dados: InvestigacaoDados;
    token_publico: string;
    motivo_rejeicao: string | null;
  };
  categoriasById: Record<string, Categoria>;
  grausById: Record<string, Grau>;
  storagePublicBase: string;
}

export function InvestigacaoDetailSection({
  ocorrenciaId, investigacao, categoriasById, grausById, storagePublicBase,
}: InvestigacaoDetailSectionProps) {
  const editHref = `/app/ocorrencias/${ocorrenciaId}/investigacao`;
  const reportHref = `/ocorrencias/relatorio/${investigacao.token_publico}`;
  const { situacao } = investigacao;

  return (
    <section className="flex flex-col gap-6 rounded-md border border-[var(--color-border)] bg-white p-6">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Investigação
        </h2>
        <StatusPill domain="investigacao" situacao={situacao} />
      </header>

      <InvestigacaoDataView
        dados={investigacao.dados}
        categoriasById={categoriasById}
        grausById={grausById}
        storagePublicBase={storagePublicBase}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4">
        {situacao === "em_andamento" && (
          <Link href={editHref}>
            <Button>Abrir investigação</Button>
          </Link>
        )}
        {situacao === "em_aprovacao" && (
          <>
            <p className="mr-2 text-sm text-[var(--color-fg-muted)]">Aguardando aprovação.</p>
            <Link href={editHref}><Button>Revisar agora</Button></Link>
            <Link href={reportHref} target="_blank">
              <Button variant="secondary">Ver relatório</Button>
            </Link>
          </>
        )}
        {situacao === "rejeitada" && (
          <div className="flex w-full flex-col gap-3">
            {investigacao.motivo_rejeicao ? (
              <div className="rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-3 text-sm">
                <p className="mb-1 font-medium text-[var(--color-danger)]">Motivo da rejeição</p>
                <p className="whitespace-pre-wrap text-[var(--color-fg)]">{investigacao.motivo_rejeicao}</p>
              </div>
            ) : null}
            <Link href={editHref} className="self-start">
              <Button>Ajustar investigação</Button>
            </Link>
          </div>
        )}
        {situacao === "aprovada" && (
          <Link href={reportHref} target="_blank">
            <Button variant="secondary">Ver relatório</Button>
          </Link>
        )}
        {situacao === "cancelada" && (
          <p className="text-sm text-[var(--color-fg-muted)]">Investigação cancelada.</p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/investigacoes/investigacao-detail-section.tsx
git commit -m "$(cat <<'EOF'
feat(investigacao): InvestigacaoDetailSection — full data + status action bar

Replaces InvestigationStatus. Shows InvestigacaoDataView + action buttons
per situacao: em_andamento→Abrir, em_aprovacao→Revisar+Relatório,
rejeitada→motivo+Ajustar, aprovada→Relatório, cancelada→note.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire admin ocorrência detail page + delete dead code

**Files:**
- Modify: `app/app/ocorrencias/[id]/page.tsx`
- Delete: `components/investigacoes/investigation-status.tsx`
- Delete: `components/investigacoes/investigacao-summary.tsx`

Depends on Tasks 1+2.

- [ ] **Step 1: Verify nothing else imports the dead code**

```bash
cd /Users/heizen/DEV/maia-app
grep -rn "InvestigationStatus\|InvestigacaoSummary" --include="*.tsx" --include="*.ts" app/ components/ lib/ | grep -v node_modules
```

Expected: only `app/app/ocorrencias/[id]/page.tsx` (InvestigationStatus) and `components/investigacoes/investigation-status.tsx` (InvestigacaoSummary). If any unexpected consumers appear, investigate before proceeding.

- [ ] **Step 2: Rewrite `app/app/ocorrencias/[id]/page.tsx`**

Replace the entire file content with:

```tsx
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireEquipe } from "@/components/gates/equipe-only";
import { DetailHeader } from "@/components/detail/detail-header";
import { StatusPill } from "@/components/data/status-pill";
import { TimelineEvents, type TimelineEventRow } from "@/components/detail/timeline-events";
import { OcorrenciaDetailCard, type OcorrenciaFull } from "@/components/ocorrencias/ocorrencia-detail-card";
import { InvestigacaoDetailSection } from "@/components/investigacoes/investigacao-detail-section";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

const EMPTY_DADOS: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

type OcorrenciaWithInvestigacoes = OcorrenciaFull & {
  investigacoes: {
    id: string;
    situacao: "em_andamento" | "em_aprovacao" | "aprovada" | "rejeitada" | "cancelada";
    dados: InvestigacaoDados | null;
    token_publico: string;
    motivo_rejeicao: string | null;
  }[] | null;
};

export default async function OcorrenciaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireEquipe("safety");
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const [
    { data: rawRow },
    { data: timelineData },
    { data: categoriasData },
    { data: grausData },
  ] = await Promise.all([
    supabase
      .from("ocorrencias")
      .select("*, empresas!inner(nome), unidades!inner(nome), investigacoes(id, situacao, dados, token_publico, motivo_rejeicao)")
      .eq("id", id)
      .single(),
    supabase
      .from("eventos")
      .select("id, evento, ocorrido_em, usuarios:autor_id(nome)")
      .eq("tipo_entidade", "ocorrencia")
      .eq("entidade_id", id)
      .order("ocorrido_em", { ascending: false })
      .returns<TimelineEventRow[]>(),
    supabase
      .from("investigacao_categorias")
      .select("id, codigo, rotulo")
      .eq("ativo", true),
    supabase
      .from("investigacao_graus")
      .select("id, rotulo")
      .eq("ativo", true),
  ]);

  if (!rawRow) notFound();
  const row = rawRow as unknown as OcorrenciaWithInvestigacoes;

  const categoriasById = Object.fromEntries(
    (categoriasData ?? []).map((c) => [c.id, { rotulo: c.rotulo, codigo: c.codigo }]),
  );
  const grausById = Object.fromEntries(
    (grausData ?? []).map((g) => [g.id, { rotulo: g.rotulo }]),
  );
  const storagePublicBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attachments/`;

  const inv = row.investigacoes?.[0];

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        breadcrumbs={[
          { label: "Painel", href: "/app/painel" },
          { label: "Ocorrências", href: "/app/ocorrencias" },
          { label: ocorrenciaTipoLabel(row.tipo) },
        ]}
        title={ocorrenciaTipoLabel(row.tipo)}
        meta={
          <>
            <StatusPill domain="ocorrencia" situacao={row.situacao} />
            <span>{row.empresas?.nome ?? "—"}</span>
            <span className="font-mono">{new Date(row.data_ocorrencia).toLocaleString("pt-BR")}</span>
          </>
        }
      />

      {inv && (
        <InvestigacaoDetailSection
          ocorrenciaId={row.id}
          investigacao={{ ...inv, dados: inv.dados ?? EMPTY_DADOS }}
          categoriasById={categoriasById}
          grausById={grausById}
          storagePublicBase={storagePublicBase}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <OcorrenciaDetailCard o={row} />
        <aside className="flex flex-col gap-6">
          <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
              Histórico
            </h2>
            <TimelineEvents rows={timelineData ?? []} tipoEntidade="ocorrencia" />
          </section>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Delete dead components**

```bash
rm components/investigacoes/investigation-status.tsx
rm components/investigacoes/investigacao-summary.tsx
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors. If any TS errors reference the deleted files, fix the import in the file reported.

- [ ] **Step 5: Run tests**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: 159 passed.

- [ ] **Step 6: Commit**

```bash
git add app/app/ocorrencias/[id]/page.tsx
git rm components/investigacoes/investigation-status.tsx
git rm components/investigacoes/investigacao-summary.tsx
git commit -m "$(cat <<'EOF'
feat(ocorrencia): full investigacao display on admin detail page

Replaces InvestigationStatus stub with InvestigacaoDetailSection showing
all investigation data. Removes InvestigationStatus + InvestigacaoSummary
as dead code.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add investigation display to public status page

**Files:**
- Modify: `app/(public)/ocorrencias/status/[token]/page.tsx`

Depends on Task 1 (`InvestigacaoDataView` must exist).

- [ ] **Step 1: Rewrite `app/(public)/ocorrencias/status/[token]/page.tsx`**

Replace the entire file content with:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PublicFormShell } from "@/components/forms/public-form-shell";
import { InvestigacaoDataView } from "@/components/investigacoes/investigacao-data-view";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import type { InvestigacaoDados } from "@/lib/investigacao-dados";

const EMPTY_DADOS: InvestigacaoDados = { ishikawa: [], plano_acao: [], participantes: [], fotos: [] };

const SITUACAO_LABEL: Record<string, string> = {
  aberta:          "Aberta",
  em_investigacao: "Em investigação",
  finalizada:      "Finalizada",
  cancelada:       "Cancelada",
  concluida:       "Concluída",
};

const SITUACAO_TONE: Record<string, string> = {
  aberta:          "bg-yellow-50 text-yellow-800 border-yellow-200",
  em_investigacao: "bg-blue-50 text-blue-800 border-blue-200",
  finalizada:      "bg-green-50 text-green-800 border-green-200",
  concluida:       "bg-green-50 text-green-800 border-green-200",
  cancelada:       "bg-gray-100 text-gray-700 border-gray-200",
};

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: o } = await supabase
    .from("ocorrencias")
    .select(`
      id, serial_id, situacao, tipo, data_ocorrencia, descricao,
      colaborador_nome, cpf,
      empresas!inner(nome),
      unidades!inner(nome)
    `)
    .eq("token_edicao", token)
    .single();

  if (!o) notFound();

  const [{ data: inv }, { data: categoriasData }, { data: grausData }] = await Promise.all([
    supabase
      .from("investigacoes")
      .select("id, situacao, dados, token_publico, motivo_rejeicao")
      .eq("ocorrencia_id", o.id)
      .maybeSingle(),
    supabase.from("investigacao_categorias").select("id, codigo, rotulo").eq("ativo", true),
    supabase.from("investigacao_graus").select("id, rotulo").eq("ativo", true),
  ]);

  const categoriasById = Object.fromEntries(
    (categoriasData ?? []).map((c) => [c.id, { rotulo: c.rotulo, codigo: c.codigo }]),
  );
  const grausById = Object.fromEntries(
    (grausData ?? []).map((g) => [g.id, { rotulo: g.rotulo }]),
  );
  const storagePublicBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/attachments/`;

  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "—";
  const tone = SITUACAO_TONE[o.situacao] ?? SITUACAO_TONE.aberta;
  const invDados: InvestigacaoDados = (inv?.dados as InvestigacaoDados | null) ?? EMPTY_DADOS;

  return (
    <PublicFormShell
      title={`Ocorrência ${idLabel}`}
      banner="Acompanhamento da sua ocorrência. Esta página atualiza conforme a equipe de segurança avança na investigação."
    >
      <div className={`mb-4 rounded-md border px-3 py-2 text-sm font-medium ${tone}`}>
        Situação atual: {SITUACAO_LABEL[o.situacao] ?? o.situacao}
      </div>

      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
        <dt className="text-[var(--color-fg-muted)]">Identificador</dt>
        <dd>{idLabel}</dd>
        <dt className="text-[var(--color-fg-muted)]">Tipo</dt>
        <dd>{ocorrenciaTipoLabel(o.tipo)}</dd>
        <dt className="text-[var(--color-fg-muted)]">Data</dt>
        <dd>{new Date(o.data_ocorrencia).toLocaleString("pt-BR")}</dd>
        <dt className="text-[var(--color-fg-muted)]">Colaborador</dt>
        <dd>{o.colaborador_nome ?? "—"}{o.cpf ? ` (${o.cpf})` : ""}</dd>
        <dt className="text-[var(--color-fg-muted)]">Empresa</dt>
        <dd>{o.empresas.nome}</dd>
        <dt className="text-[var(--color-fg-muted)]">Unidade</dt>
        <dd>{o.unidades.nome}</dd>
        <dt className="text-[var(--color-fg-muted)]">Descrição</dt>
        <dd>{o.descricao ?? "—"}</dd>
      </dl>

      {inv && (
        <div className="mt-6 border-t border-[var(--color-border)] pt-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
            Investigação
          </h2>
          <InvestigacaoDataView
            dados={invDados}
            categoriasById={categoriasById}
            grausById={grausById}
            storagePublicBase={storagePublicBase}
          />
          {(inv.situacao === "em_andamento" || inv.situacao === "rejeitada") && (
            <div className="mt-4">
              <Link
                href={`/investigacoes/editar/${inv.token_publico}`}
                className="text-sm font-medium text-[var(--brand-primary-600)] hover:underline"
              >
                Editar investigação →
              </Link>
            </div>
          )}
        </div>
      )}
    </PublicFormShell>
  );
}
```

Note: uses `.maybeSingle()` instead of `.single()` for the investigation query — returns `null` without error if the investigation doesn't exist yet (edge case during creation).

- [ ] **Step 2: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors.

- [ ] **Step 3: Run tests**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: 159 passed.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/ocorrencias/status/[token]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(public): show full investigacao data on ocorrencia status page

Adds investigation section below ocorrência fields: Ishikawa, plano de ação,
participantes, fotos. Edit link shown when em_andamento or rejeitada.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Filter investigações list to active-only

**Files:**
- Modify: `app/app/investigacoes/page.tsx`

Independent of all other tasks.

- [ ] **Step 1: Edit `app/app/investigacoes/page.tsx`**

In the Supabase query, add the situacao filter. Replace the query block (lines 25–30):

```ts
// Before
  const { data } = await supabase
    .from("investigacoes")
    .select("id, situacao, ocorrencias!inner(id, tipo, data_ocorrencia, empresas!inner(nome))")
    .order("criado_em", { ascending: false })
    .limit(200)
    .returns<InvestigacaoRow[]>();
```

```ts
// After
  const { data } = await supabase
    .from("investigacoes")
    .select("id, situacao, ocorrencias!inner(id, tipo, data_ocorrencia, empresas!inner(nome))")
    .in("situacao", ["em_andamento", "em_aprovacao", "rejeitada"])
    .order("criado_em", { ascending: false })
    .limit(200)
    .returns<InvestigacaoRow[]>();
```

Also update the subtitle (line 71–73):

```tsx
// Before
        <p className="text-sm text-[var(--color-fg-muted)]">
          {rows.length} registro{rows.length === 1 ? "" : "s"}
        </p>
```

```tsx
// After
        <p className="text-sm text-[var(--color-fg-muted)]">
          {rows.length} investigaç{rows.length === 1 ? "ão" : "ões"} em aberto
        </p>
```

Also update the EmptyState hint (line 84):

```tsx
// Before
            hint="As investigações aparecem aqui quando uma ocorrência é registrada."
```

```tsx
// After
            hint="Todas as investigações foram resolvidas ou não há ocorrências registradas."
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors.

- [ ] **Step 3: Run tests**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: 159 passed.

- [ ] **Step 4: Commit**

```bash
git add app/app/investigacoes/page.tsx
git commit -m "$(cat <<'EOF'
fix(investigacoes): filter list to active situacoes only

Only em_andamento, em_aprovacao, rejeitada shown — list is now a work queue.
Approved and canceled investigations fall off once resolved.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | grep "error TS" | head -5
grep -rn "InvestigationStatus\|InvestigacaoSummary" --include="*.tsx" --include="*.ts" app/ components/ | grep -v node_modules
```

Expected: 159 tests pass, 0 TS errors, 0 import references to deleted components.

**Manual smoke checklist:**
- [ ] Admin: `/app/ocorrencias/[id]` — investigation section shows Ishikawa, plano de ação, participantes, fotos (empty states for newly submitted ocorrências)
- [ ] Admin: `em_andamento` → "Abrir investigação" button
- [ ] Admin: `em_aprovacao` → "Aguardando aprovação" + "Revisar agora" + "Ver relatório"
- [ ] Admin: `rejeitada` → red callout with motivo + "Ajustar investigação"
- [ ] Admin: `aprovada` → "Ver relatório" only
- [ ] Public: `/ocorrencias/status/[token]` — investigation section below ocorrência fields
- [ ] Public: edit link visible when `em_andamento` or `rejeitada`
- [ ] `/app/investigacoes` — only shows em_andamento, em_aprovacao, rejeitada rows
