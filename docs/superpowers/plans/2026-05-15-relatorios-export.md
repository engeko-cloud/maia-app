# Relatorios Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV report export (email delivery) for afastamentos and ocorrencias, with filters by empresa, unidade, CPF, and date range.

**Architecture:** Pure CSV generation helpers live in `lib/relatorio/` (easily unit-tested). Each domain has its own API route (`app/api/relatorios/{domain}`) that verifies auth (safety or admin), queries Supabase admin client with no row limit, generates CSV in memory, and sends it as a Resend email attachment to the requesting user. A shared client `ExportDialog` component renders the filter form and POSTs to the route. Parent pages (server components) fetch empresa/unidade lists and pass them as props.

**Tech Stack:** Next.js 15 (server + client components), TypeScript, Resend (already in project), shadcn/ui Dialog + Select + Input + Label, Vitest.

---

## File Map

**Create:**
- `lib/relatorio/csv.ts` — pure CSV escaping/joining helpers
- `lib/relatorio/afastamentos-csv.ts` — afastamentos row type, column headers, row mapper
- `lib/relatorio/ocorrencias-csv.ts` — ocorrencias row type, column headers, row mapper
- `emails/relatorio-pronto.ts` — email template for "your report is attached"
- `app/api/relatorios/afastamentos/route.ts` — POST: auth, query, CSV, email
- `app/api/relatorios/ocorrencias/route.ts` — POST: auth, query, CSV, email
- `components/relatorios/export-dialog.tsx` — client dialog with filter form
- `tests/unit/relatorio-csv.test.ts` — unit tests for CSV helpers
- `tests/unit/afastamentos-csv.test.ts` — unit tests for afastamentos mapper
- `tests/unit/ocorrencias-csv.test.ts` — unit tests for ocorrencias mapper

**Modify:**
- `app/(app)/afastamentos/page.tsx` — add empresa/unidade queries + ExportDialog button
- `app/(app)/ocorrencias/page.tsx` — add empresa/unidade queries + ExportDialog button

---

### Task 1: CSV generation utility

**Files:**
- Create: `lib/relatorio/csv.ts`
- Create: `tests/unit/relatorio-csv.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/relatorio-csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toCsvRow, toCsvFile } from "@/lib/relatorio/csv";

describe("toCsvRow", () => {
  it("joins plain values with commas", () => {
    expect(toCsvRow(["a", "b", "c"])).toBe("a,b,c");
  });
  it("quotes values containing commas", () => {
    expect(toCsvRow(["hello, world"])).toBe('"hello, world"');
  });
  it("escapes double-quotes by doubling them", () => {
    expect(toCsvRow(['say "hi"'])).toBe('"say ""hi"""');
  });
  it("quotes values containing newlines", () => {
    expect(toCsvRow(["line1\nline2"])).toBe('"line1\nline2"');
  });
  it("passes through plain values unchanged", () => {
    expect(toCsvRow(["Alice", "30", ""])).toBe("Alice,30,");
  });
});

describe("toCsvFile", () => {
  it("returns header row + data rows separated by CRLF", () => {
    const result = toCsvFile(["Name", "Age"], [["Alice", "30"], ["Bob", "25"]]);
    expect(result).toBe("Name,Age\r\nAlice,30\r\nBob,25");
  });
  it("handles empty rows array (headers only)", () => {
    expect(toCsvFile(["A", "B"], [])).toBe("A,B");
  });
  it("joins all rows with CRLF", () => {
    const lines = toCsvFile(["X"], [["1"], ["2"], ["3"]]).split("\r\n");
    expect(lines).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd /Users/heizen/DEV/maia-app && npx vitest run tests/unit/relatorio-csv.test.ts 2>&1 | tail -10
```

Expected: error about missing module `@/lib/relatorio/csv`.

- [ ] **Step 3: Implement `lib/relatorio/csv.ts`**

```ts
function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(values: string[]): string {
  return values.map(escapeCsvValue).join(",");
}

export function toCsvFile(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map(toCsvRow).join("\r\n");
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd /Users/heizen/DEV/maia-app && npx vitest run tests/unit/relatorio-csv.test.ts 2>&1 | tail -10
```

Expected: 8 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /Users/heizen/DEV/maia-app && git add lib/relatorio/csv.ts tests/unit/relatorio-csv.test.ts && git commit -m "feat(relatorio): CSV generation utility"
```

---

### Task 2: Afastamentos CSV mapper

**Files:**
- Create: `lib/relatorio/afastamentos-csv.ts`
- Create: `tests/unit/afastamentos-csv.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/afastamentos-csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  toAfastamentoCsvRows,
  AFASTAMENTO_HEADERS,
  type AfastamentoReportRow,
} from "@/lib/relatorio/afastamentos-csv";

const baseRow: AfastamentoReportRow = {
  serial_id: 42,
  cpf: "12345678901",
  colaborador_nome: "João Silva",
  colaborador_cargo: "Técnico",
  colaborador_setor: "Manutenção",
  data_inicio: "2024-01-15",
  data_fim: "2024-01-20",
  duracao: 5,
  situacao: "aprovado",
  acidente: false,
  inss: true,
  internacao: false,
  cid: "Z99",
  afastamento_tipos: { rotulo: "Médico" },
  empresas: { nome: "Engeko" },
  unidades: { nome: "Matriz" },
};

describe("toAfastamentoCsvRows", () => {
  it("maps fields in the order matching AFASTAMENTO_HEADERS", () => {
    const [row] = toAfastamentoCsvRows([baseRow]);
    expect(row[0]).toBe("42");           // serial_id
    expect(row[1]).toBe("12345678901");  // cpf
    expect(row[2]).toBe("João Silva");   // colaborador_nome
    expect(row[3]).toBe("Técnico");      // cargo
    expect(row[4]).toBe("Manutenção");   // setor
    expect(row[5]).toBe("Engeko");       // empresa
    expect(row[6]).toBe("Matriz");       // unidade
    expect(row[7]).toBe("Médico");       // tipo
    expect(row[8]).toBe("2024-01-15");   // data_inicio
    expect(row[9]).toBe("2024-01-20");   // data_fim
    expect(row[10]).toBe("5");           // duracao
    expect(row[11]).toBe("aprovado");    // situacao
    expect(row[12]).toBe("Não");         // acidente
    expect(row[13]).toBe("Sim");         // inss
    expect(row[14]).toBe("Não");         // internacao
    expect(row[15]).toBe("Z99");         // cid
  });

  it("uses empty string for null fields", () => {
    const row = toAfastamentoCsvRows([{
      ...baseRow,
      colaborador_cargo: null,
      cid: null,
      data_fim: null,
      duracao: null,
    }])[0];
    expect(row[3]).toBe("");
    expect(row[9]).toBe("");
    expect(row[10]).toBe("");
    expect(row[15]).toBe("");
  });

  it("row length equals AFASTAMENTO_HEADERS length", () => {
    const [row] = toAfastamentoCsvRows([baseRow]);
    expect(row).toHaveLength(AFASTAMENTO_HEADERS.length);
  });

  it("returns empty array for empty input", () => {
    expect(toAfastamentoCsvRows([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd /Users/heizen/DEV/maia-app && npx vitest run tests/unit/afastamentos-csv.test.ts 2>&1 | tail -10
```

Expected: error about missing module.

- [ ] **Step 3: Implement `lib/relatorio/afastamentos-csv.ts`**

```ts
export type AfastamentoReportRow = {
  serial_id: number;
  cpf: string;
  colaborador_nome: string | null;
  colaborador_cargo: string | null;
  colaborador_setor: string | null;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  situacao: string;
  acidente: boolean;
  inss: boolean;
  internacao: boolean;
  cid: string | null;
  afastamento_tipos: { rotulo: string } | null;
  empresas: { nome: string } | null;
  unidades: { nome: string } | null;
};

export const AFASTAMENTO_HEADERS = [
  "ID",
  "CPF",
  "Colaborador",
  "Cargo",
  "Setor",
  "Empresa",
  "Unidade",
  "Tipo",
  "Data início",
  "Data fim",
  "Duração (dias)",
  "Situação",
  "Acidente",
  "INSS",
  "Internação",
  "CID",
];

export function toAfastamentoCsvRows(rows: AfastamentoReportRow[]): string[][] {
  return rows.map((r) => [
    String(r.serial_id),
    r.cpf,
    r.colaborador_nome ?? "",
    r.colaborador_cargo ?? "",
    r.colaborador_setor ?? "",
    r.empresas?.nome ?? "",
    r.unidades?.nome ?? "",
    r.afastamento_tipos?.rotulo ?? "",
    r.data_inicio,
    r.data_fim ?? "",
    r.duracao != null ? String(r.duracao) : "",
    r.situacao,
    r.acidente ? "Sim" : "Não",
    r.inss ? "Sim" : "Não",
    r.internacao ? "Sim" : "Não",
    r.cid ?? "",
  ]);
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd /Users/heizen/DEV/maia-app && npx vitest run tests/unit/afastamentos-csv.test.ts 2>&1 | tail -10
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/heizen/DEV/maia-app && git add lib/relatorio/afastamentos-csv.ts tests/unit/afastamentos-csv.test.ts && git commit -m "feat(relatorio): afastamentos CSV mapper"
```

---

### Task 3: Ocorrencias CSV mapper

**Files:**
- Create: `lib/relatorio/ocorrencias-csv.ts`
- Create: `tests/unit/ocorrencias-csv.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/ocorrencias-csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  toOcorrenciaCsvRows,
  OCORRENCIA_HEADERS,
  type OcorrenciaReportRow,
} from "@/lib/relatorio/ocorrencias-csv";

const baseRow: OcorrenciaReportRow = {
  serial_id: 7,
  cpf: "98765432100",
  colaborador_nome: "Ana Costa",
  colaborador_cargo: "Operadora",
  colaborador_setor: "Produção",
  tipo: "acidente_trabalho",
  data_ocorrencia: "2024-03-10",
  hora_ocorrencia: "14:30",
  situacao: "concluida",
  afastamento: true,
  atendimento: true,
  bo: false,
  internacao: false,
  morte: false,
  cid: "S50",
  empresas: { nome: "Engeko" },
  unidades: { nome: "Filial SP" },
};

describe("toOcorrenciaCsvRows", () => {
  it("maps fields in the order matching OCORRENCIA_HEADERS", () => {
    const [row] = toOcorrenciaCsvRows([baseRow]);
    expect(row[0]).toBe("7");                   // serial_id
    expect(row[1]).toBe("98765432100");          // cpf
    expect(row[2]).toBe("Ana Costa");            // colaborador_nome
    expect(row[3]).toBe("Operadora");            // cargo
    expect(row[4]).toBe("Produção");             // setor
    expect(row[5]).toBe("Engeko");               // empresa
    expect(row[6]).toBe("Filial SP");            // unidade
    expect(row[7]).toBe("acidente_trabalho");    // tipo
    expect(row[8]).toBe("2024-03-10");           // data_ocorrencia
    expect(row[9]).toBe("14:30");                // hora_ocorrencia
    expect(row[10]).toBe("concluida");           // situacao
    expect(row[11]).toBe("Sim");                 // afastamento
    expect(row[12]).toBe("Sim");                 // atendimento
    expect(row[13]).toBe("Não");                 // bo
    expect(row[14]).toBe("Não");                 // internacao
    expect(row[15]).toBe("Não");                 // morte
    expect(row[16]).toBe("S50");                 // cid
  });

  it("uses empty string for null fields", () => {
    const row = toOcorrenciaCsvRows([{
      ...baseRow,
      cpf: null,
      hora_ocorrencia: null,
      cid: null,
    }])[0];
    expect(row[1]).toBe("");
    expect(row[9]).toBe("");
    expect(row[16]).toBe("");
  });

  it("row length equals OCORRENCIA_HEADERS length", () => {
    const [row] = toOcorrenciaCsvRows([baseRow]);
    expect(row).toHaveLength(OCORRENCIA_HEADERS.length);
  });

  it("returns empty array for empty input", () => {
    expect(toOcorrenciaCsvRows([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd /Users/heizen/DEV/maia-app && npx vitest run tests/unit/ocorrencias-csv.test.ts 2>&1 | tail -10
```

Expected: error about missing module.

- [ ] **Step 3: Implement `lib/relatorio/ocorrencias-csv.ts`**

```ts
export type OcorrenciaReportRow = {
  serial_id: number;
  cpf: string | null;
  colaborador_nome: string | null;
  colaborador_cargo: string | null;
  colaborador_setor: string | null;
  tipo: string;
  data_ocorrencia: string;
  hora_ocorrencia: string | null;
  situacao: string;
  afastamento: boolean;
  atendimento: boolean;
  bo: boolean;
  internacao: boolean;
  morte: boolean;
  cid: string | null;
  empresas: { nome: string } | null;
  unidades: { nome: string } | null;
};

export const OCORRENCIA_HEADERS = [
  "ID",
  "CPF",
  "Colaborador",
  "Cargo",
  "Setor",
  "Empresa",
  "Unidade",
  "Tipo",
  "Data ocorrência",
  "Hora ocorrência",
  "Situação",
  "Afastamento",
  "Atendimento",
  "BO",
  "Internação",
  "Morte",
  "CID",
];

export function toOcorrenciaCsvRows(rows: OcorrenciaReportRow[]): string[][] {
  return rows.map((r) => [
    String(r.serial_id),
    r.cpf ?? "",
    r.colaborador_nome ?? "",
    r.colaborador_cargo ?? "",
    r.colaborador_setor ?? "",
    r.empresas?.nome ?? "",
    r.unidades?.nome ?? "",
    r.tipo,
    r.data_ocorrencia,
    r.hora_ocorrencia ?? "",
    r.situacao,
    r.afastamento ? "Sim" : "Não",
    r.atendimento ? "Sim" : "Não",
    r.bo ? "Sim" : "Não",
    r.internacao ? "Sim" : "Não",
    r.morte ? "Sim" : "Não",
    r.cid ?? "",
  ]);
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd /Users/heizen/DEV/maia-app && npx vitest run tests/unit/ocorrencias-csv.test.ts 2>&1 | tail -10
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/heizen/DEV/maia-app && git add lib/relatorio/ocorrencias-csv.ts tests/unit/ocorrencias-csv.test.ts && git commit -m "feat(relatorio): ocorrencias CSV mapper"
```

---

### Task 4: Report email template

**Files:**
- Create: `emails/relatorio-pronto.ts`

No test needed — pure HTML string generation with no branching logic, same pattern as every other email template in this project.

- [ ] **Step 1: Create `emails/relatorio-pronto.ts`**

```ts
import { layout } from "./_layout";
import { escapeHtml } from "./_escape";
import { EMAIL_COLORS } from "./tokens";

export type RelatorioEmail = {
  domain: string;
  filterSummary: string;
  rowCount: number;
};

export function relatorioPronto(data: { r: RelatorioEmail }): string {
  const { r } = data;
  const body = `
    <p style="margin:16px 0;">
      Seu relatório de <strong>${escapeHtml(r.domain)}</strong> está pronto e segue em anexo neste e-mail.
    </p>
    <table role="presentation" style="width:100%;border:1px solid ${EMAIL_COLORS.border};border-radius:8px;padding:12px;border-collapse:collapse;">
      <tbody>
        <tr style="border-bottom:1px solid ${EMAIL_COLORS.border};">
          <td style="width:40%;font-size:12px;color:${EMAIL_COLORS.muted};padding:8px 0;vertical-align:top;">Filtros aplicados</td>
          <td style="font-size:14px;padding:8px 0;">${escapeHtml(r.filterSummary || "Nenhum")}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:${EMAIL_COLORS.muted};padding:8px 0;vertical-align:top;">Total de registros</td>
          <td style="font-size:14px;padding:8px 0;">${r.rowCount}</td>
        </tr>
      </tbody>
    </table>
  `;
  return layout(`Relatório de ${r.domain}`, body);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "relatorio-pronto"
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
cd /Users/heizen/DEV/maia-app && git add emails/relatorio-pronto.ts && git commit -m "feat(relatorio): report ready email template"
```

---

### Task 5: Afastamentos report API route

**Files:**
- Create: `app/api/relatorios/afastamentos/route.ts`

**Context:** `requireSafetyOrAdmin()` is in `lib/admin-auth.ts`. It returns a Supabase `User` object or `null`. `getSupabaseAdmin()` in `lib/supabase/admin.ts` is NOT async (no await). Both Resend and the admin client use env vars already set in the project. The POST body carries `empresa_nome`/`unidade_nome` (human-readable names for the email summary) alongside the UUIDs.

- [ ] **Step 1: Create `app/api/relatorios/afastamentos/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toCsvFile } from "@/lib/relatorio/csv";
import {
  toAfastamentoCsvRows,
  AFASTAMENTO_HEADERS,
  type AfastamentoReportRow,
} from "@/lib/relatorio/afastamentos-csv";
import { relatorioPronto } from "@/emails/relatorio-pronto";

export async function POST(req: NextRequest) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    empresa_id?: string;
    empresa_nome?: string;
    unidade_id?: string;
    unidade_nome?: string;
    cpf?: string;
    data_de?: string;
    data_ate?: string;
  };

  const admin = getSupabaseAdmin();
  let q = admin
    .from("afastamentos")
    .select(
      "serial_id, cpf, colaborador_nome, colaborador_cargo, colaborador_setor, data_inicio, data_fim, duracao, situacao, acidente, inss, internacao, cid, afastamento_tipos!inner(rotulo), empresas!inner(nome), unidades!inner(nome)",
    )
    .order("data_inicio", { ascending: false });

  if (body.empresa_id) q = q.eq("empresa_id", body.empresa_id);
  if (body.unidade_id) q = q.eq("unidade_id", body.unidade_id);
  if (body.cpf)        q = q.eq("cpf", body.cpf);
  if (body.data_de)    q = q.gte("data_inicio", body.data_de);
  if (body.data_ate)   q = q.lte("data_inicio", body.data_ate);

  const { data, error } = await q.returns<AfastamentoReportRow[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const csv = toCsvFile(AFASTAMENTO_HEADERS, toAfastamentoCsvRows(rows));

  const parts: string[] = [];
  if (body.empresa_nome) parts.push(`Empresa: ${body.empresa_nome}`);
  if (body.unidade_nome) parts.push(`Unidade: ${body.unidade_nome}`);
  if (body.cpf)          parts.push(`CPF: ${body.cpf}`);
  if (body.data_de)      parts.push(`De: ${body.data_de}`);
  if (body.data_ate)     parts.push(`Até: ${body.data_ate}`);

  const html = relatorioPronto({
    r: {
      domain: "Afastamentos",
      filterSummary: parts.join(", "),
      rowCount: rows.length,
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const resend = new Resend(process.env.RESEND_TEST_API_KEY!);
  const { error: mailError } = await resend.emails.send({
    from: "Maia <maia@fapptory.me>",
    to: user.email!,
    subject: `Relatório de afastamentos — ${today}`,
    html,
    attachments: [
      {
        filename: `afastamentos-${today}.csv`,
        content: Buffer.from(csv, "utf-8"),
      },
    ],
  });

  if (mailError) return NextResponse.json({ error: mailError.message }, { status: 500 });
  return NextResponse.json({ message: "Relatório enviado para o seu e-mail." });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "relatorios/afastamentos"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/heizen/DEV/maia-app && git add app/api/relatorios/afastamentos/route.ts && git commit -m "feat(relatorio): afastamentos report API route"
```

---

### Task 6: Ocorrencias report API route

**Files:**
- Create: `app/api/relatorios/ocorrencias/route.ts`

**Context:** Same pattern as Task 5. Date filter field is `data_ocorrencia` (not `data_inicio`). Ocorrencias `cpf` is nullable in the table, but the eq filter still works correctly — it will simply return no rows if you filter by a CPF not in the table.

- [ ] **Step 1: Create `app/api/relatorios/ocorrencias/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toCsvFile } from "@/lib/relatorio/csv";
import {
  toOcorrenciaCsvRows,
  OCORRENCIA_HEADERS,
  type OcorrenciaReportRow,
} from "@/lib/relatorio/ocorrencias-csv";
import { relatorioPronto } from "@/emails/relatorio-pronto";

export async function POST(req: NextRequest) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    empresa_id?: string;
    empresa_nome?: string;
    unidade_id?: string;
    unidade_nome?: string;
    cpf?: string;
    data_de?: string;
    data_ate?: string;
  };

  const admin = getSupabaseAdmin();
  let q = admin
    .from("ocorrencias")
    .select(
      "serial_id, cpf, colaborador_nome, colaborador_cargo, colaborador_setor, tipo, data_ocorrencia, hora_ocorrencia, situacao, afastamento, atendimento, bo, internacao, morte, cid, empresas!inner(nome), unidades!inner(nome)",
    )
    .order("data_ocorrencia", { ascending: false });

  if (body.empresa_id) q = q.eq("empresa_id", body.empresa_id);
  if (body.unidade_id) q = q.eq("unidade_id", body.unidade_id);
  if (body.cpf)        q = q.eq("cpf", body.cpf);
  if (body.data_de)    q = q.gte("data_ocorrencia", body.data_de);
  if (body.data_ate)   q = q.lte("data_ocorrencia", body.data_ate);

  const { data, error } = await q.returns<OcorrenciaReportRow[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const csv = toCsvFile(OCORRENCIA_HEADERS, toOcorrenciaCsvRows(rows));

  const parts: string[] = [];
  if (body.empresa_nome) parts.push(`Empresa: ${body.empresa_nome}`);
  if (body.unidade_nome) parts.push(`Unidade: ${body.unidade_nome}`);
  if (body.cpf)          parts.push(`CPF: ${body.cpf}`);
  if (body.data_de)      parts.push(`De: ${body.data_de}`);
  if (body.data_ate)     parts.push(`Até: ${body.data_ate}`);

  const html = relatorioPronto({
    r: {
      domain: "Ocorrências",
      filterSummary: parts.join(", "),
      rowCount: rows.length,
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const resend = new Resend(process.env.RESEND_TEST_API_KEY!);
  const { error: mailError } = await resend.emails.send({
    from: "Maia <maia@fapptory.me>",
    to: user.email!,
    subject: `Relatório de ocorrências — ${today}`,
    html,
    attachments: [
      {
        filename: `ocorrencias-${today}.csv`,
        content: Buffer.from(csv, "utf-8"),
      },
    ],
  });

  if (mailError) return NextResponse.json({ error: mailError.message }, { status: 500 });
  return NextResponse.json({ message: "Relatório enviado para o seu e-mail." });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "relatorios/ocorrencias"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/heizen/DEV/maia-app && git add app/api/relatorios/ocorrencias/route.ts && git commit -m "feat(relatorio): ocorrencias report API route"
```

---

### Task 7: ExportDialog client component

**Files:**
- Create: `components/relatorios/export-dialog.tsx`

**Context:** This is a `"use client"` component. It uses shadcn/ui `Dialog`, `Select`, `Input`, `Label` from `@/components/ui/`. The `Select` from shadcn/ui wraps Radix UI — use a `"__all__"` sentinel for the "no filter" option to avoid empty-string value issues with Radix. The dialog POSTs to `/api/relatorios/{domain}`. On success it shows a confirmation message. On close/reopen it resets to the form.

- [ ] **Step 1: Create `components/relatorios/export-dialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EmpresaOption = { id: string; nome: string };
export type UnidadeOption = { id: string; nome: string };

interface ExportDialogProps {
  domain: "afastamentos" | "ocorrencias";
  empresas: EmpresaOption[];
  unidades: UnidadeOption[];
}

const ALL = "__all__";

export function ExportDialog({ domain, empresas, unidades }: ExportDialogProps) {
  const [open, setOpen]           = useState(false);
  const [empresaId, setEmpresaId] = useState(ALL);
  const [unidadeId, setUnidadeId] = useState(ALL);
  const [cpf, setCpf]             = useState("");
  const [dataDe, setDataDe]       = useState("");
  const [dataAte, setDataAte]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState("");

  const domainLabel = domain === "afastamentos" ? "Afastamentos" : "Ocorrências";
  const dateLabel   = domain === "afastamentos" ? "Início" : "Ocorrência";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const selectedEmpresa = empresas.find((x) => x.id === empresaId);
    const selectedUnidade = unidades.find((x) => x.id === unidadeId);

    try {
      const res = await fetch(`/api/relatorios/${domain}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id:   empresaId !== ALL ? empresaId : undefined,
          empresa_nome: selectedEmpresa?.nome,
          unidade_id:   unidadeId !== ALL ? unidadeId : undefined,
          unidade_nome: selectedUnidade?.nome,
          cpf:          cpf.trim() || undefined,
          data_de:      dataDe || undefined,
          data_ate:     dataAte || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao gerar relatório.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setDone(false);
      setError("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-foreground hover:border-[var(--color-fg-muted)] transition-colors"
        >
          <DownloadIcon className="size-4" aria-hidden="true" />
          Exportar
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar {domainLabel}</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center">
            <p className="text-sm text-[var(--color-fg-muted)]">
              Relatório enviado para o seu e-mail.
            </p>
            <button
              type="button"
              className="mt-4 text-sm font-medium text-[var(--brand-primary-600)] hover:underline"
              onClick={() => setDone(false)}
            >
              Exportar novamente
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`export-empresa-${domain}`}>Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger id={`export-empresa-${domain}`}>
                  <SelectValue placeholder="Todas as empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as empresas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`export-unidade-${domain}`}>Unidade</Label>
              <Select value={unidadeId} onValueChange={setUnidadeId}>
                <SelectTrigger id={`export-unidade-${domain}`}>
                  <SelectValue placeholder="Todas as unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as unidades</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`export-cpf-${domain}`}>CPF do colaborador</Label>
              <Input
                id={`export-cpf-${domain}`}
                placeholder="Todos"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                maxLength={11}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`export-data-de-${domain}`}>{dateLabel} de</Label>
                <Input
                  id={`export-data-de-${domain}`}
                  type="date"
                  value={dataDe}
                  onChange={(e) => setDataDe(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`export-data-ate-${domain}`}>{dateLabel} até</Label>
                <Input
                  id={`export-data-ate-${domain}`}
                  type="date"
                  value={dataAte}
                  onChange={(e) => setDataAte(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-foreground transition-colors"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-[var(--brand-primary-600)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-700)] disabled:opacity-50 transition-colors"
              >
                {loading ? "Gerando…" : "Enviar relatório"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "export-dialog"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/heizen/DEV/maia-app && git add components/relatorios/export-dialog.tsx && git commit -m "feat(relatorio): ExportDialog client component"
```

---

### Task 8: Wire ExportDialog into afastamentos page

**Files:**
- Modify: `app/(app)/afastamentos/page.tsx`

**Context:** The current page uses a single Supabase query. Add empresa and unidade queries fetched in parallel using `Promise.all`. Import `ExportDialog` and add it next to the "Novo afastamento" link in the header. The `ExportDialog` is a client component and can be used directly inside a server component.

Current header right side (line 96–107 of `app/(app)/afastamentos/page.tsx`):
```tsx
<Link
  href="/forms/afastamentos"
  className="relative inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary-600)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-700)]"
>
  <PlusIcon className="size-4" aria-hidden="true" />
  Novo afastamento
  <span
    aria-hidden="true"
    className="absolute -bottom-px left-2 right-2 h-[2px] bg-[var(--brand-accent-500)]"
  />
</Link>
```

- [ ] **Step 1: Add import**

Add to the top imports of `app/(app)/afastamentos/page.tsx`:

```tsx
import { ExportDialog } from "@/components/relatorios/export-dialog";
```

- [ ] **Step 2: Add empresa/unidade queries**

Replace the single `const { data } = await query.returns<AfastamentoRow[]>();` block with a `Promise.all`. The file currently runs the afastamentos query independently. Replace:

```ts
const { data } = await query.returns<AfastamentoRow[]>();
const rows = data ?? [];
```

with:

```ts
const [{ data }, { data: empresasData }, { data: unidadesData }] = await Promise.all([
  query.returns<AfastamentoRow[]>(),
  supabase.from("empresas").select("id, nome").order("nome"),
  supabase.from("unidades").select("id, nome").order("nome"),
]);
const rows     = data ?? [];
const empresas = (empresasData ?? []) as { id: string; nome: string }[];
const unidades = (unidadesData ?? []) as { id: string; nome: string }[];
```

- [ ] **Step 3: Replace the header action area**

Replace the standalone `<Link href="/forms/afastamentos" ...>` element in the header with a wrapper div containing both the ExportDialog and the Link:

```tsx
<div className="flex items-center gap-2">
  <ExportDialog domain="afastamentos" empresas={empresas} unidades={unidades} />
  <Link
    href="/forms/afastamentos"
    className="relative inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary-600)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-700)]"
  >
    <PlusIcon className="size-4" aria-hidden="true" />
    Novo afastamento
    <span
      aria-hidden="true"
      className="absolute -bottom-px left-2 right-2 h-[2px] bg-[var(--brand-accent-500)]"
    />
  </Link>
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "afastamentos/page"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd /Users/heizen/DEV/maia-app && git add "app/(app)/afastamentos/page.tsx" && git commit -m "feat(relatorio): add Exportar button to afastamentos list"
```

---

### Task 9: Wire ExportDialog into ocorrencias page

**Files:**
- Modify: `app/(app)/ocorrencias/page.tsx`

**Context:** Same pattern as Task 8. Current ocorrencias page runs a single Supabase query. Add empresa/unidade queries in parallel and render ExportDialog next to "Nova ocorrência" link.

Current header right side (around line 69–76 of `app/(app)/ocorrencias/page.tsx`):
```tsx
<Link
  href="/forms/ocorrencias"
  className="relative inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary-600)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-700)]"
>
  <PlusIcon className="size-4" aria-hidden="true" />
  Nova ocorrência
  <span aria-hidden="true" className="absolute -bottom-px left-2 right-2 h-[2px] bg-[var(--brand-accent-500)]" />
</Link>
```

- [ ] **Step 1: Add import**

Add to the top imports of `app/(app)/ocorrencias/page.tsx`:

```tsx
import { ExportDialog } from "@/components/relatorios/export-dialog";
```

- [ ] **Step 2: Add empresa/unidade queries**

The current ocorrencias query is built as `let query = supabase.from("ocorrencias")...` then `const { data } = await query.returns<OcorrenciaRow[]>()`. Replace the `await` line:

```ts
const { data } = await query.returns<OcorrenciaRow[]>();
const rows = data ?? [];
```

with:

```ts
const [{ data }, { data: empresasData }, { data: unidadesData }] = await Promise.all([
  query.returns<OcorrenciaRow[]>(),
  supabase.from("empresas").select("id, nome").order("nome"),
  supabase.from("unidades").select("id, nome").order("nome"),
]);
const rows     = data ?? [];
const empresas = (empresasData ?? []) as { id: string; nome: string }[];
const unidades = (unidadesData ?? []) as { id: string; nome: string }[];
```

- [ ] **Step 3: Replace the header action area**

Replace the standalone `<Link href="/forms/ocorrencias" ...>` element with a wrapper div:

```tsx
<div className="flex items-center gap-2">
  <ExportDialog domain="ocorrencias" empresas={empresas} unidades={unidades} />
  <Link
    href="/forms/ocorrencias"
    className="relative inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary-600)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-700)]"
  >
    <PlusIcon className="size-4" aria-hidden="true" />
    Nova ocorrência
    <span aria-hidden="true" className="absolute -bottom-px left-2 right-2 h-[2px] bg-[var(--brand-accent-500)]" />
  </Link>
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "ocorrencias/page"
```

Expected: no output.

- [ ] **Step 5: Run all unit tests to confirm no regressions**

```bash
cd /Users/heizen/DEV/maia-app && npx vitest run tests/unit/ 2>&1 | tail -15
```

Expected: all tests pass including the 3 new test files.

- [ ] **Step 6: Commit**

```bash
cd /Users/heizen/DEV/maia-app && git add "app/(app)/ocorrencias/page.tsx" && git commit -m "feat(relatorio): add Exportar button to ocorrencias list"
```

---

## Self-Review

**Spec coverage:**
- ✅ Afastamentos export — Task 5 + Task 8
- ✅ Ocorrencias export — Task 6 + Task 9
- ✅ Filter by empresa — `empresa_id` param in API + Select in dialog
- ✅ Filter by unidade — `unidade_id` param in API + Select in dialog
- ✅ Filter by CPF (colaborador) — `cpf` param in API + Input in dialog
- ✅ Date filter for start date — `data_de`/`data_ate` params → `data_inicio` (afastamentos), `data_ocorrencia` (ocorrencias)
- ✅ CSV format — Tasks 1–3
- ✅ Email delivery (not browser download) — Resend with attachment in Tasks 5–6
- ✅ Whole database export (no row limit) — no `.limit()` in report queries
- ✅ Heavy export handled — generates in API route; Resend delivers async

**Placeholder scan:** None found — all code blocks are complete.

**Type consistency:**
- `AfastamentoReportRow` defined in Task 2, used in Task 5 ✅
- `OcorrenciaReportRow` defined in Task 3, used in Task 6 ✅
- `RelatorioEmail` defined in Task 4, used in Tasks 5 and 6 ✅
- `EmpresaOption` / `UnidadeOption` defined in Task 7, used in Tasks 8 and 9 ✅
- `relatorioPronto` defined in Task 4, called in Tasks 5 and 6 ✅
- `toCsvFile` defined in Task 1, called in Tasks 5 and 6 ✅
- `toAfastamentoCsvRows` / `AFASTAMENTO_HEADERS` defined in Task 2, called in Task 5 ✅
- `toOcorrenciaCsvRows` / `OCORRENCIA_HEADERS` defined in Task 3, called in Task 6 ✅
