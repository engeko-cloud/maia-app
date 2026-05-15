# Phase 8 Auth Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the portal authentication so workers identify by CPF + email (not email alone), add auto-registration after OTP, and add admin CRUD for pre-registering collaborator CPFs.

**Architecture:** The `colaboradores` table is rebuilt with `cpf` as primary key and `auth_id` as a nullable FK — admins can pre-register CPFs before workers log in. Login: CPF + email form → server validates against `colaboradores`/`afastamentos` → client triggers OTP to provided email (with CPF in user metadata) → after OTP, portal layout auto-registers the `colaboradores` row via `autoRegisterColaborador`. The `/portal/cadastro` registration flow is deleted; registration is implicit.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + auth), zod, react-hook-form, Vitest, Tailwind CSS.

**Repos:**
- DB migrations: `/Users/heizen/DEV/maia-db/supabase/migrations/`
- App: `/Users/heizen/DEV/maia-app/`

---

## File Map

**Create:**
- `maia-db/supabase/migrations/023_colaboradores_redesign.sql`
- `maia-app/app/api/portal/login-init/route.ts`
- `maia-app/lib/portal-register.ts`
- `maia-app/app/(admin)/admin/colaboradores/page.tsx`
- `maia-app/app/api/admin/colaboradores/route.ts`
- `maia-app/app/api/admin/colaboradores/[cpf]/route.ts`
- `maia-app/tests/unit/portal-register.test.ts`

**Modify:**
- `maia-db/supabase/migrations/021_seed_portal.sql` — match new schema
- `maia-app/lib/supabase/database.types.ts` — regen (via CLI after applying migration)
- `maia-app/lib/portal-auth.ts` — query by `auth_id` instead of `id`
- `maia-app/app/(portal)/layout.tsx` — auto-register instead of redirect to /portal/cadastro
- `maia-app/app/(portal-public)/portal/login/page.tsx` — CPF + email form, two-step
- `maia-app/middleware.ts` — remove `/portal/cadastro` from public portal routes
- `maia-app/app/(admin)/admin/page.tsx` — add colaboradores admin card
- `maia-app/tests/unit/portal-auth.test.ts` — add `auth_id` assertion test

**Delete:**
- `maia-app/app/(portal-public)/portal/cadastro/page.tsx`
- `maia-app/app/api/portal/cadastro/route.ts`
- `maia-app/lib/portal-cadastro.ts`
- `maia-app/tests/unit/portal-cadastro-validation.test.ts`

---

## Task 1: DB Migration — Redesign colaboradores table

**Files:**
- Create: `/Users/heizen/DEV/maia-db/supabase/migrations/023_colaboradores_redesign.sql`

The old schema: `colaboradores(id uuid primary key references auth.users(id), cpf text unique)`.
New schema: `colaboradores(cpf text primary key, email text nullable, auth_id uuid unique references auth.users(id) on delete set null)`.
The `colaborador_cpf()` function must change its WHERE from `id = uid` to `auth_id = uid`.
RLS policies must be recreated.

- [ ] **Step 1: Write the migration**

```sql
-- Phase 8 auth redesign: CPF-primary colaboradores table.
-- Old schema used auth.users id as PK; new schema uses CPF as PK so admins
-- can pre-register workers before they log in (auth_id is nullable).

-- 1. Drop policies and function that depend on old table shape.
drop policy if exists colaboradores_self_read on colaboradores;
drop policy if exists afastamentos_colaborador_read on afastamentos;
drop function if exists colaborador_cpf(uuid);

-- 2. Drop old table and recreate with new shape.
drop table if exists colaboradores;

create table colaboradores (
  cpf       text primary key,
  email     text,            -- nullable: admin can pre-register CPF without email
  auth_id   uuid unique references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);

alter table colaboradores enable row level security;

-- Colaborador sees only their own row (matched by auth_id).
create policy colaboradores_self_read on colaboradores for select
  using ((select auth.uid()) = auth_id);

-- 3. Recreate helper — now queries by auth_id.
create or replace function colaborador_cpf(uid uuid) returns text
  language sql stable security definer
  set search_path = ''
  as $$ select cpf from public.colaboradores where auth_id = uid $$;

revoke execute on function colaborador_cpf(uuid) from public;

-- 4. Restore afastamentos read policy (unchanged signature, new underlying table shape).
create policy afastamentos_colaborador_read on afastamentos for select
  using (cpf = colaborador_cpf((select auth.uid())));
```

- [ ] **Step 2: Verify the file exists**

```bash
ls /Users/heizen/DEV/maia-db/supabase/migrations/023_colaboradores_redesign.sql
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
cd /Users/heizen/DEV/maia-db
git add supabase/migrations/023_colaboradores_redesign.sql
git commit -m "feat(portal): redesign colaboradores — cpf pk, auth_id nullable fk"
```

---

## Task 2: Update dev seed to match new schema

**Files:**
- Modify: `/Users/heizen/DEV/maia-db/supabase/migrations/021_seed_portal.sql`

The old seed inserted `(id, cpf)` into colaboradores. The new schema requires `(cpf, email, auth_id)`.

- [ ] **Step 1: Read the current seed**

Read `/Users/heizen/DEV/maia-db/supabase/migrations/021_seed_portal.sql` to confirm current content.

- [ ] **Step 2: Replace the colaboradores insert block**

Old block (lines 47-49):
```sql
  insert into public.colaboradores (id, cpf)
  values (v_user_id, v_cpf)
  on conflict (id) do nothing;
```

Replace with:
```sql
  insert into public.colaboradores (cpf, email, auth_id)
  values (v_cpf, v_email, v_user_id)
  on conflict (cpf) do update set auth_id = excluded.auth_id, email = excluded.email;
```

- [ ] **Step 3: Apply migrations locally and verify**

Run from `/Users/heizen/DEV/maia-db`:
```bash
npx supabase db reset
```

Expected: migrations run to completion with no errors. Check that `supabase db reset` completes without ERROR lines.

- [ ] **Step 4: Commit**

```bash
cd /Users/heizen/DEV/maia-db
git add supabase/migrations/021_seed_portal.sql
git commit -m "fix(seed): update portal seed for new colaboradores schema"
```

---

## Task 3: Regen Supabase types

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/lib/supabase/database.types.ts`

The local Supabase stack must have migration 023 applied (done in Task 2 via `db reset`). Regen types.

- [ ] **Step 1: Regen types**

```bash
cd /Users/heizen/DEV/maia-app
npx supabase gen types typescript --local > lib/supabase/database.types.ts
```

Expected: file updated with `colaboradores` table showing columns `cpf`, `email`, `auth_id`, `criado_em`.

- [ ] **Step 2: Verify TSC still passes**

```bash
cd /Users/heizen/DEV/maia-app
npx tsc --noEmit
```

Expected: no errors (type errors will appear in later tasks when the app code still references old columns — resolve them in their respective tasks).

- [ ] **Step 3: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add lib/supabase/database.types.ts
git commit -m "chore: regen supabase types after colaboradores schema redesign"
```

---

## Task 4: Delete obsolete cadastro files

**Files:**
- Delete: `app/(portal-public)/portal/cadastro/page.tsx`
- Delete: `app/api/portal/cadastro/route.ts`
- Delete: `lib/portal-cadastro.ts`
- Delete: `tests/unit/portal-cadastro-validation.test.ts`

- [ ] **Step 1: Delete the files**

```bash
cd /Users/heizen/DEV/maia-app
rm "app/(portal-public)/portal/cadastro/page.tsx"
rm "app/api/portal/cadastro/route.ts"
rm lib/portal-cadastro.ts
rm tests/unit/portal-cadastro-validation.test.ts
```

- [ ] **Step 2: Verify no other file imports portal-cadastro**

```bash
cd /Users/heizen/DEV/maia-app
grep -r "portal-cadastro\|portal/cadastro" --include="*.ts" --include="*.tsx" .
```

Expected: no output (nothing imports the deleted files).

- [ ] **Step 3: Run tests — expect deletions to reduce count**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run
```

Expected: passes with fewer tests (the 6 deleted cadastro tests are gone).

- [ ] **Step 4: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add -A
git commit -m "refactor(portal): delete obsolete cadastro flow"
```

---

## Task 5: Create login-init API route

**Files:**
- Create: `app/api/portal/login-init/route.ts`

This POST endpoint:
1. Validates `{ cpf: string, email: string }`.
2. Checks `colaboradores` by CPF (admin-managed records).
   - If found AND `colab.email` is set AND doesn't match → 403 "wrong email".
   - If found AND email matches (or no email stored) → 200 ok.
3. If not in `colaboradores`, checks `afastamentos` by CPF.
   - None found → 404.
   - Found → 200 ok.

The client then calls `signInWithOtp` after receiving 200.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/portal-login-init.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/portal/login-init/route";

vi.mock("@/lib/supabase/admin");

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const mockGetAdmin = vi.mocked(getSupabaseAdmin);

function makeAdmin({
  colaborador,
  afastamentosCount,
  afastamentosError = null,
}: {
  colaborador: { email: string | null; auth_id: string | null } | null;
  afastamentosCount: number;
  afastamentosError?: unknown;
}) {
  let callCount = 0;
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "colaboradores") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: colaborador, error: null }),
            }),
          }),
        };
      }
      // afastamentos
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: undefined,
            count: afastamentosCount,
            error: afastamentosError,
          }),
        }),
      };
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

function makeAfastamentosAdmin({ count, error }: { count: number; error?: unknown }) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "colaboradores") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count, error: error ?? null }),
        }),
      };
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

function req(body: unknown) {
  return new Request("http://localhost/api/portal/login-init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/portal/login-init", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid CPF", async () => {
    mockGetAdmin.mockReturnValue({} as ReturnType<typeof getSupabaseAdmin>);
    const res = await POST(req({ cpf: "123", email: "a@b.com" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    mockGetAdmin.mockReturnValue({} as ReturnType<typeof getSupabaseAdmin>);
    const res = await POST(req({ cpf: "11111111111", email: "not-an-email" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 200 when CPF is in colaboradores and email matches", async () => {
    mockGetAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { email: "ana@engeko.com", auth_id: null },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);
    const res = await POST(req({ cpf: "11111111111", email: "ana@engeko.com" }) as never);
    expect(res.status).toBe(200);
  });

  it("returns 403 when CPF is in colaboradores but email mismatches", async () => {
    mockGetAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { email: "ana@engeko.com", auth_id: null },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);
    const res = await POST(req({ cpf: "11111111111", email: "wrong@other.com" }) as never);
    expect(res.status).toBe(403);
  });

  it("returns 200 when CPF not in colaboradores but has afastamentos", async () => {
    mockGetAdmin.mockReturnValue(makeAfastamentosAdmin({ count: 3 }));
    const res = await POST(req({ cpf: "11111111111", email: "new@worker.com" }) as never);
    expect(res.status).toBe(200);
  });

  it("returns 404 when CPF not in colaboradores and no afastamentos", async () => {
    mockGetAdmin.mockReturnValue(makeAfastamentosAdmin({ count: 0 }));
    const res = await POST(req({ cpf: "11111111111", email: "new@worker.com" }) as never);
    expect(res.status).toBe(404);
  });

  it("returns 500 when afastamentos query errors", async () => {
    mockGetAdmin.mockReturnValue(makeAfastamentosAdmin({ count: 0, error: { message: "db error" } }));
    const res = await POST(req({ cpf: "11111111111", email: "new@worker.com" }) as never);
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run tests/unit/portal-login-init.test.ts
```

Expected: FAIL — route file doesn't exist yet.

- [ ] **Step 3: Create the route**

Create `app/api/portal/login-init/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Schema = z.object({
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }
  const { cpf, email } = parsed.data;
  const admin = getSupabaseAdmin();

  // Check if CPF is pre-registered by admin.
  const { data: colab } = await admin
    .from("colaboradores")
    .select("email, auth_id")
    .eq("cpf", cpf)
    .single();

  if (colab) {
    if (colab.email && colab.email.toLowerCase() !== email) {
      return NextResponse.json(
        { error: "Email não corresponde ao cadastro. Entre em contato com o RH." },
        { status: 403 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  // CPF not pre-registered — check afastamentos records.
  const { count, error: countError } = await admin
    .from("afastamentos")
    .select("id", { count: "exact", head: true })
    .eq("cpf", cpf);

  if (countError) return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  if (!count) {
    return NextResponse.json(
      { error: "CPF não encontrado nos nossos registros." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run tests/unit/portal-login-init.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add app/api/portal/login-init/route.ts tests/unit/portal-login-init.test.ts
git commit -m "feat(portal): login-init route — cpf+email check before otp"
```

---

## Task 6: Create lib/portal-register.ts

**Files:**
- Create: `lib/portal-register.ts`
- Create: `tests/unit/portal-register.test.ts`

This module exposes `autoRegisterColaborador(authId, cpf, email)` which upserts a `colaboradores` row. Called by the portal layout when a freshly-authed user has no `colaboradores` row yet.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/portal-register.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin");

import { autoRegisterColaborador } from "@/lib/portal-register";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const mockGetAdmin = vi.mocked(getSupabaseAdmin);

function makeAdmin(upsertError: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: upsertError }),
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

describe("autoRegisterColaborador", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true when upsert succeeds", async () => {
    mockGetAdmin.mockReturnValue(makeAdmin(null));
    const result = await autoRegisterColaborador("uid-abc", "11111111111", "ana@engeko.com");
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns ok:false with error message when upsert fails", async () => {
    mockGetAdmin.mockReturnValue(makeAdmin({ message: "unique_violation" }));
    const result = await autoRegisterColaborador("uid-abc", "11111111111", "ana@engeko.com");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("unique_violation");
  });

  it("calls upsert with cpf, email, auth_id and onConflict cpf", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mockGetAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue({ upsert: upsertMock }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);
    await autoRegisterColaborador("uid-abc", "11111111111", "ana@engeko.com");
    expect(upsertMock).toHaveBeenCalledWith(
      { cpf: "11111111111", email: "ana@engeko.com", auth_id: "uid-abc" },
      { onConflict: "cpf" },
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module doesn't exist)**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run tests/unit/portal-register.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the module**

Create `lib/portal-register.ts`:

```ts
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function autoRegisterColaborador(
  authId: string,
  cpf: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("colaboradores")
    .upsert({ cpf, email, auth_id: authId }, { onConflict: "cpf" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run tests/unit/portal-register.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add lib/portal-register.ts tests/unit/portal-register.test.ts
git commit -m "feat(portal): autoRegisterColaborador — upsert colaboradores on first login"
```

---

## Task 7: Update lib/portal-auth.ts

**Files:**
- Modify: `lib/portal-auth.ts`
- Modify: `tests/unit/portal-auth.test.ts`

Change `.eq("id", user.id)` → `.eq("auth_id", user.id)` and add a test that asserts the correct column name.

- [ ] **Step 1: Read current file**

Read `lib/portal-auth.ts` (already known — query uses `.eq("id", user.id)`).

- [ ] **Step 2: Update portal-auth.ts**

Replace the full file content:

```ts
import type { User } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";

export type ColaboradorSession =
  | { status: "unauthenticated" }
  | { status: "no_profile"; user: User }
  | { status: "ok"; user: User; cpf: string };

export async function requireColaborador(): Promise<ColaboradorSession> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "unauthenticated" };

  const { data } = await supabase
    .from("colaboradores")
    .select("cpf")
    .eq("auth_id", user.id)
    .single();

  if (!data) return { status: "no_profile", user };
  return { status: "ok", user, cpf: data.cpf };
}
```

- [ ] **Step 3: Add auth_id assertion test to portal-auth.test.ts**

Read `tests/unit/portal-auth.test.ts` to see the current 3 tests, then add a 4th test after the existing ones:

```ts
  it("queries colaboradores by auth_id (not id)", async () => {
    let capturedEqColumn: unknown;
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: FAKE_USER } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((col: unknown) => {
            capturedEqColumn = col;
            return {
              single: vi.fn().mockResolvedValue({ data: { cpf: "11111111111" }, error: null }),
            };
          }),
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof getSupabaseServer>>;
    mockGetSupabaseServer.mockResolvedValue(client);
    await requireColaborador();
    expect(capturedEqColumn).toBe("auth_id");
  });
```

- [ ] **Step 4: Run tests — all 4 pass**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run tests/unit/portal-auth.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add lib/portal-auth.ts tests/unit/portal-auth.test.ts
git commit -m "fix(portal): query colaboradores by auth_id instead of id"
```

---

## Task 8: Update portal layout — auto-register instead of redirect

**Files:**
- Modify: `app/(portal)/layout.tsx`

When `requireColaborador()` returns `no_profile`, read `user.user_metadata.cpf` and `user.email`, call `autoRegisterColaborador`, then render children normally. The page (children) calls `requireColaborador()` in its own data fetch and will find the freshly-inserted row. If metadata is missing, redirect to `/portal/login`.

- [ ] **Step 1: Read the current layout**

Read `app/(portal)/layout.tsx`.

- [ ] **Step 2: Rewrite the layout**

```tsx
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo-mark";
import { requireColaborador } from "@/lib/portal-auth";
import { autoRegisterColaborador } from "@/lib/portal-register";
import { PortalLogoutButton } from "@/components/portal/portal-logout-button";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireColaborador();
  if (session.status === "unauthenticated") redirect("/portal/login");

  if (session.status === "no_profile") {
    const cpf = session.user.user_metadata?.cpf as string | undefined;
    const email = session.user.email;
    if (!cpf || !email) redirect("/portal/login");
    const { ok } = await autoRegisterColaborador(session.user.id, cpf, email);
    if (!ok) redirect("/portal/login");
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)]">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <LogoMark size="sm" />
            <span className="text-sm font-semibold tracking-tight">
              MAIA <span className="text-[var(--brand-accent-500)]">·</span> Minha Área
            </span>
          </div>
          <PortalLogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Run TSC — no errors**

```bash
cd /Users/heizen/DEV/maia-app
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add "app/(portal)/layout.tsx"
git commit -m "feat(portal): auto-register colaborador on first login instead of redirecting to /cadastro"
```

---

## Task 9: Rewrite portal login page — CPF + email form

**Files:**
- Modify: `app/(portal-public)/portal/login/page.tsx`

New two-step form:
- Step `cred`: CPF (11 digits) + email → POST to `/api/portal/login-init` → if ok, call `signInWithOtp` with `data.cpf` in metadata → advance to `otp` step.
- Step `otp`: 6-digit code → `verifyOtp` → redirect to `/portal/painel`.

- [ ] **Step 1: Read the current login page**

Read `app/(portal-public)/portal/login/page.tsx`.

- [ ] **Step 2: Replace the full file**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const CredSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter exatamente 11 dígitos"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
});
const OtpSchema = z.object({
  code: z.string().length(6, "O código tem exatamente 6 dígitos"),
});

type CredInput = z.infer<typeof CredSchema>;
type OtpInput = z.infer<typeof OtpSchema>;
type Step = "cred" | "otp";

const PITCH = {
  headingWords: ["Seus", "afastamentos,", "sempre", "acessíveis."],
  accentIndex: 1,
  sub: "Consulte o status dos seus afastamentos registrados na ENGEKO a qualquer hora.",
};

export default function PortalLoginPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("cred");
  const [cpf, setCpf] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const credForm = useForm<CredInput>({
    resolver: zodResolver(CredSchema),
    defaultValues: { cpf: "", email: "" },
  });

  const otpForm = useForm<OtpInput>({
    resolver: zodResolver(OtpSchema),
    defaultValues: { code: "" },
  });

  async function onCredSubmit(values: CredInput) {
    setError(null);
    const res = await fetch("/api/portal/login-init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "Erro inesperado." }));
      setError(msg ?? "Erro inesperado.");
      return;
    }
    const supabase = getSupabaseBrowser();
    await supabase.auth.signInWithOtp({
      email: values.email,
      options: { shouldCreateUser: true, data: { cpf: values.cpf } },
    });
    setCpf(values.cpf);
    setEmail(values.email);
    setStep("otp");
  }

  async function onOtpSubmit(values: OtpInput) {
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: values.code,
      type: "email",
    });
    if (error) {
      setError("Código inválido ou expirado. Solicite um novo código.");
      return;
    }
    router.push("/portal/painel");
    router.refresh();
  }

  return (
    <AuthCard
      title="Área do Colaborador"
      lead={
        step === "cred"
          ? "Informe seu CPF e email para receber o código de acesso."
          : `Enviamos um código de 6 dígitos para ${email}.`
      }
      pitch={PITCH}
    >
      {step === "cred" ? (
        <Form {...credForm}>
          <form onSubmit={credForm.handleSubmit(onCredSubmit)} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <FormField
              control={credForm.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="Somente números"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={credForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full border-b-[3px] border-[var(--brand-accent-500)]"
              disabled={credForm.formState.isSubmitting}
            >
              {credForm.formState.isSubmitting ? "Verificando…" : "Enviar código"}
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <FormField
              control={otpForm.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de 6 dígitos</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="one-time-code"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full border-b-[3px] border-[var(--brand-accent-500)]"
              disabled={otpForm.formState.isSubmitting}
            >
              {otpForm.formState.isSubmitting ? "Verificando…" : "Entrar"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep("cred");
                setError(null);
                setCpf("");
                setEmail("");
                credForm.reset();
              }}
              className="w-full text-sm text-[var(--color-fg-muted)] hover:text-foreground"
            >
              Tentar novamente
            </button>
          </form>
        </Form>
      )}
    </AuthCard>
  );
}
```

Note: `cpf` state is stored but not directly used in the OTP step (it's already embedded in Supabase user metadata via `signInWithOtp`). It's kept for potential future use.

- [ ] **Step 3: Run TSC**

```bash
cd /Users/heizen/DEV/maia-app
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add "app/(portal-public)/portal/login/page.tsx"
git commit -m "feat(portal): cpf+email login form with server-side validation before otp"
```

---

## Task 10: Update middleware — remove /portal/cadastro from public

**Files:**
- Modify: `middleware.ts`

The `isPortalPublic` constant includes `/portal/cadastro`. Since the cadastro flow is deleted, remove it.

- [ ] **Step 1: Read the current middleware**

Read `middleware.ts`.

- [ ] **Step 2: Edit isPortalPublic**

Find:
```ts
  const isPortalPublic =
    path.startsWith("/portal/login") || path.startsWith("/portal/cadastro");
```

Replace with:
```ts
  const isPortalPublic = path.startsWith("/portal/login");
```

- [ ] **Step 3: Run TSC**

```bash
cd /Users/heizen/DEV/maia-app
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add middleware.ts
git commit -m "fix(middleware): remove deleted /portal/cadastro from public portal routes"
```

---

## Task 11: Admin colaboradores API routes

**Files:**
- Create: `app/api/admin/colaboradores/route.ts`
- Create: `app/api/admin/colaboradores/[cpf]/route.ts`

GET returns all collaborators. POST inserts a new CPF (optionally with email). DELETE at `[cpf]` removes a collaborator record.

- [ ] **Step 1: Create the collection route**

Create `app/api/admin/colaboradores/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const Schema = z.object({
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  email: z.string().trim().toLowerCase().email("Email inválido").nullable().optional(),
});

export async function GET() {
  if (!(await requireAdminUser())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("colaboradores")
    .select("cpf, email, auth_id, criado_em")
    .order("criado_em", { ascending: false });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("colaboradores")
    .insert({ cpf: parsed.data.cpf, email: parsed.data.email ?? null })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "CPF já cadastrado." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Create the item route (DELETE)**

Create `app/api/admin/colaboradores/[cpf]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ cpf: string }> },
) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { cpf } = await params;
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("colaboradores").delete().eq("cpf", cpf);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Run TSC**

```bash
cd /Users/heizen/DEV/maia-app
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all unit tests**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add "app/api/admin/colaboradores/route.ts" "app/api/admin/colaboradores/[cpf]/route.ts"
git commit -m "feat(admin): colaboradores CRUD API — GET/POST + DELETE by cpf"
```

---

## Task 12: Admin colaboradores page

**Files:**
- Create: `app/(admin)/admin/colaboradores/page.tsx`

Client component that fetches from `/api/admin/colaboradores`. Displays a table of CPF, email, linked status (auth_id set or not). Sheet for adding a new CPF+email. Dialog for confirming deletion. No edit — email is updated at worker's first login.

- [ ] **Step 1: Create the page**

Create `app/(admin)/admin/colaboradores/page.tsx`:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/data/empty-state";

type Colaborador = {
  cpf: string;
  email: string | null;
  auth_id: string | null;
  criado_em: string;
};

const ENDPOINT = "/api/admin/colaboradores";

export default function ColaboradoresPage() {
  const [rows, setRows] = React.useState<Colaborador[]>([]);
  const [formOpen, setFormOpen] = React.useState(false);
  const [confirmDeleteCpf, setConfirmDeleteCpf] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ cpf: "", email: "" });
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const r = await fetch(ENDPOINT);
    if (!r.ok) {
      toast.error("Erro ao carregar colaboradores.");
      return;
    }
    setRows(await r.json());
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf: form.cpf, email: form.email || null }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error((j as { error?: string }).error ?? "Erro");
      return;
    }
    toast.success("Colaborador adicionado.");
    setFormOpen(false);
    setForm({ cpf: "", email: "" });
    await load();
  }

  async function handleDelete() {
    if (!confirmDeleteCpf) return;
    setBusy(true);
    const r = await fetch(`${ENDPOINT}/${encodeURIComponent(confirmDeleteCpf)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!r.ok) {
      toast.error("Erro ao remover colaborador.");
      return;
    }
    toast.success("Colaborador removido.");
    setConfirmDeleteCpf(null);
    await load();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/admin" className="hover:text-foreground">
            Administração
          </Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">
            Colaboradores
          </span>
        </nav>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Colaboradores</h1>
            <p className="text-sm text-[var(--color-fg-muted)]">
              CPFs pré-cadastrados para acesso ao portal do colaborador.
            </p>
          </div>
          <Sheet open={formOpen} onOpenChange={setFormOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={() => setForm({ cpf: "", email: "" })}>
                <PlusIcon className="mr-1 size-4" aria-hidden="true" />
                Adicionar
              </Button>
            </SheetTrigger>
            <SheetContent>
              <form onSubmit={handleAdd} className="flex flex-col gap-4">
                <SheetHeader>
                  <SheetTitle>Novo colaborador</SheetTitle>
                  <SheetDescription>
                    Registre o CPF. O email é opcional — se informado, será obrigatório no login.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cpf-input">CPF (somente números)</Label>
                  <Input
                    id="cpf-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    value={form.cpf}
                    onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
                    required
                    pattern="\d{11}"
                    title="Exatamente 11 dígitos"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email-input">Email (opcional)</Label>
                  <Input
                    id="email-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <SheetFooter>
                  <SheetClose asChild>
                    <Button type="button" variant="outline">
                      Cancelar
                    </Button>
                  </SheetClose>
                  <Button type="submit" disabled={busy}>
                    {busy ? "Salvando…" : "Salvar"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState message="Nenhum colaborador cadastrado." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CPF</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.cpf}>
                <TableCell className="font-mono text-sm">{row.cpf}</TableCell>
                <TableCell>
                  {row.email ?? (
                    <span className="text-[var(--color-fg-subtle)]">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.auth_id ? (
                    <Badge variant="default">Vinculado</Badge>
                  ) : (
                    <Badge variant="secondary">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    aria-label={`Remover colaborador ${row.cpf}`}
                    className="text-[var(--color-fg-muted)] hover:text-destructive"
                    onClick={() => setConfirmDeleteCpf(row.cpf)}
                  >
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={!!confirmDeleteCpf}
        onOpenChange={(open) => !open && setConfirmDeleteCpf(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover colaborador?</DialogTitle>
            <DialogDescription>
              O CPF <span className="font-mono">{confirmDeleteCpf}</span> será removido. Se
              vinculado a uma conta, o acesso ao portal será revogado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" disabled={busy} onClick={handleDelete}>
              {busy ? "Removendo…" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Run TSC**

```bash
cd /Users/heizen/DEV/maia-app
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add "app/(admin)/admin/colaboradores/page.tsx"
git commit -m "feat(admin): colaboradores management page — list, add, delete"
```

---

## Task 13: Add colaboradores to admin home

**Files:**
- Modify: `app/(admin)/admin/page.tsx`

Add a `HardHatIcon` import and a new entry in the `ITEMS` array.

- [ ] **Step 1: Read the current admin home**

Read `app/(admin)/admin/page.tsx`.

- [ ] **Step 2: Add HardHatIcon import**

Find the existing import from `lucide-react`:
```ts
import {
  Building2Icon,
  FactoryIcon,
  UsersIcon,
  UserCogIcon,
  ListTreeIcon,
  SettingsIcon,
  NetworkIcon,
  GaugeIcon,
  ListIcon,
  HeartPulseIcon,
} from "lucide-react";
```

Add `HardHatIcon` to the import list:
```ts
import {
  Building2Icon,
  FactoryIcon,
  HardHatIcon,
  UsersIcon,
  UserCogIcon,
  ListTreeIcon,
  SettingsIcon,
  NetworkIcon,
  GaugeIcon,
  ListIcon,
  HeartPulseIcon,
} from "lucide-react";
```

- [ ] **Step 3: Add colaboradores entry to ITEMS**

Add after the `usuarios` entry (second item) to keep portal-related items grouped:

```ts
  {
    href: "/admin/colaboradores",
    title: "Colaboradores",
    desc: "CPFs pré-cadastrados para acesso ao portal do colaborador.",
    icon: HardHatIcon,
  },
```

The full ITEMS array after edit (for reference — insert the new entry between `usuarios` and `equipes`):
```ts
  { href: "/painel/saude", ... },
  { href: "/admin/usuarios", ... },
  { href: "/admin/colaboradores", title: "Colaboradores", desc: "CPFs pré-cadastrados para acesso ao portal do colaborador.", icon: HardHatIcon },
  { href: "/admin/equipes", ... },
  ...rest unchanged
```

- [ ] **Step 4: Run TSC and tests**

```bash
cd /Users/heizen/DEV/maia-app
npx tsc --noEmit && npx vitest run
```

Expected: no TSC errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/heizen/DEV/maia-app
git add "app/(admin)/admin/page.tsx"
git commit -m "feat(admin): add colaboradores card to admin home"
```

---

## Task 14: Final verification

Run the full build to confirm zero type errors and all routes compile.

- [ ] **Step 1: Full type check**

```bash
cd /Users/heizen/DEV/maia-app
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Full test suite**

```bash
cd /Users/heizen/DEV/maia-app
npx vitest run
```

Expected: all tests pass. Note: deleted `portal-cadastro-validation.test.ts` (6 tests) removed; new `portal-login-init.test.ts` (7 tests), `portal-register.test.ts` (3 tests), and `portal-auth.test.ts` (4 tests) added.

- [ ] **Step 3: Build**

```bash
cd /Users/heizen/DEV/maia-app
npx next build 2>&1 | tail -30
```

Expected: build succeeds. Portal routes visible: `/portal/login`, `/portal/painel`. Cadastro routes absent.

- [ ] **Step 4: Verify portal/cadastro route is gone**

```bash
cd /Users/heizen/DEV/maia-app
npx next build 2>&1 | grep "portal"
```

Expected: `/portal/login` shown, no `/portal/cadastro`.

- [ ] **Step 5: Final commit if needed**

If any cleanup was done during verification:
```bash
cd /Users/heizen/DEV/maia-app
git add -A
git commit -m "chore: phase 8 auth redesign final cleanup"
```

---

## Self-Review

**Spec coverage check:**
- ✅ CPF+email form → server validation before OTP (Tasks 5, 9)
- ✅ Case: CPF in colaboradores, email matches → OTP sent (Task 5)
- ✅ Case: CPF in colaboradores, email mismatches → 403 "wrong email, call admin" (Task 5)
- ✅ Case: CPF not in colaboradores, afastamentos found → OTP sent (Task 5)
- ✅ Case: CPF not in colaboradores, no afastamentos → 404 (Task 5)
- ✅ Store verified email at OTP confirmation time (via upsert in autoRegisterColaborador, Task 6)
- ✅ Auto-registration: OTP metadata contains CPF, layout reads it and creates/updates row (Tasks 6, 8)
- ✅ Admin pre-register CPF without email (Tasks 11, 12)
- ✅ Admin CRUD page at /admin/colaboradores (Tasks 11, 12, 13)
- ✅ /portal/cadastro route deleted (Task 4)
- ✅ Middleware updated to not allow /portal/cadastro as public (Task 10)
- ✅ DB migration with new schema (Task 1)
- ✅ Dev seed updated (Task 2)
- ✅ Types regenerated (Task 3)

**Type consistency:** `autoRegisterColaborador(authId, cpf, email)` is consistent in `lib/portal-register.ts` and called the same way in `app/(portal)/layout.tsx`. `ColaboradorSession` is unchanged (still has `cpf` in `ok` status). `requireColaborador()` signature unchanged — internal query changed to `auth_id`.

**No placeholders:** All steps contain complete code.
