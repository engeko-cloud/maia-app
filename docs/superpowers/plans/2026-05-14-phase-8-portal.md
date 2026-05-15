# Phase 8 — Self-service Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a read-only self-service portal at `/portal` where colaboradores authenticate via email OTP and view their own afastamentos.

**Architecture:** Two new Next.js route groups — `(portal-public)` for unauthenticated entry pages (login, cadastro), `(portal)` for auth-gated pages. Data access via server components + two new RLS policies; no new API routes for reads. A new `colaboradores` table maps `auth.users.id → cpf`. Registration verifies the CPF exists on at least one `afastamento` before creating the row.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase SSR (`@supabase/ssr`), `@supabase/supabase-js` (admin client for E2E), Zod, react-hook-form, Tailwind v4, Vitest, Playwright.

---

## File Map

### maia-db
| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/019_colaboradores.sql` | Table, RLS, helper function, afastamentos policy, configuracoes portal copy columns |
| Create | `supabase/migrations/020_seed_portal.sql` | Dev seed: portal test user in auth.users + colaboradores row |

### maia-app
| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `lib/supabase/database.types.ts` | Regenerate after migration 019 |
| Create | `lib/portal-auth.ts` | `ColaboradorSession` type + `requireColaborador()` helper |
| Create | `lib/portal-cadastro.ts` | `processCadastro()` — CPF validation + DB logic (testable) |
| Create | `app/api/portal/cadastro/route.ts` | Thin POST route handler calling `processCadastro` |
| Modify | `middleware.ts` | Add `/portal` to protected routes |
| Create | `app/(portal-public)/layout.tsx` | Centering shell (same as `(auth)/layout.tsx`) |
| Create | `app/(portal-public)/portal/login/page.tsx` | Two-step OTP login client component |
| Create | `app/(portal-public)/portal/cadastro/page.tsx` | CPF form client component |
| Create | `components/portal/portal-logout-button.tsx` | Client component with signOut |
| Create | `app/(portal)/layout.tsx` | Auth gate + minimal header shell |
| Create | `app/(portal)/portal/page.tsx` | Redirect to `/portal/painel` |
| Create | `app/(portal)/portal/painel/page.tsx` | Afastamento list with portal copy |
| Create | `app/(portal)/portal/afastamentos/[id]/page.tsx` | Simplified status detail view |
| Modify | `app/(admin)/admin/configuracoes/page.tsx` | Add three portal copy text fields |
| Modify | `app/api/admin/configuracoes/route.ts` | Extend PATCH schema with portal copy fields |
| Create | `tests/unit/portal-auth.test.ts` | Unit tests for `requireColaborador()` |
| Create | `tests/unit/portal-cadastro-validation.test.ts` | Unit tests for `processCadastro()` |
| Modify | `tests/e2e/happy-path.spec.ts` | Gated Phase 8 arc |

---

## Task 1: DB migration 019 — colaboradores table, RLS, portal copy

**Repos:** maia-db

**Files:**
- Create: `supabase/migrations/019_colaboradores.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/019_colaboradores.sql`:

```sql
-- Phase 8: colaborador portal — identity table, RLS helper, afastamentos policy,
-- and portal copy columns on configuracoes.

-- 1. colaboradores table
create table colaboradores (
  id        uuid primary key references auth.users(id) on delete cascade,
  cpf       text not null unique,
  criado_em timestamptz not null default now()
);

alter table colaboradores enable row level security;

-- Colaborador can read only their own row; writes are service-role only.
create policy colaboradores_self_read on colaboradores for select
  using ((select auth.uid()) = id);

-- 2. SQL helper function — returns the CPF for a given auth.uid()
--    Used in the afastamentos RLS policy below.
create or replace function colaborador_cpf(uid uuid) returns text
  language sql stable security definer
  set search_path = ''
  as $$ select cpf from public.colaboradores where id = uid $$;

revoke execute on function colaborador_cpf(uuid) from public;

-- 3. New RLS policy on afastamentos — colaborador sees their own records.
--    The existing afastamentos_read policy (admin OR oh team) is unchanged;
--    Supabase evaluates all policies with OR.
create policy afastamentos_colaborador_read on afastamentos for select
  using (cpf = colaborador_cpf((select auth.uid())));

-- 4. Portal copy columns on configuracoes (single-row, id=1).
alter table configuracoes
  add column portal_saudacao text not null default 'Olá, {nome}.',
  add column portal_vazio    text not null default 'Nenhum afastamento registrado para o seu CPF.',
  add column portal_banner   text not null default 'Consulte o status dos seus afastamentos registrados na ENGEKO.';
```

- [ ] **Step 2: Apply the migration locally**

```bash
supabase db push --local
```

Expected: migration applied, no errors.

- [ ] **Step 3: Commit**

```bash
git -C ../maia-db add supabase/migrations/019_colaboradores.sql
git -C ../maia-db commit -m "feat(db): Phase 8 — colaboradores table, RLS, portal copy columns"
```

---

## Task 2: DB migration 020 — dev seed portal user

**Repos:** maia-db

**Files:**
- Create: `supabase/migrations/020_seed_portal.sql`

Before writing: read `supabase/migrations/017_seed_dev.sql` to confirm which CPF is used for the first seeded afastamento (`cpf` column, first row). It should be `'11111111111'` (Ana Silva). Use that CPF in this seed.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/020_seed_portal.sql`:

```sql
-- Phase 8: dev-only seed — portal test colaborador.
-- Seeded auth user + colaboradores row with a CPF that matches a 017 afastamento.
-- Idempotent via fixed UUID and on-conflict guards.
-- DO NOT APPLY IN PRODUCTION.

do $$
declare
  v_user_id uuid := 'b0000000-0000-0000-0000-000000000099';
  v_email   text := 'colaborador@seed.local';
  v_cpf     text := '11111111111'; -- matches Ana Silva in 017_seed_dev.sql
begin
  -- Insert into auth.users (local dev only; requires service-role context)
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    '',   -- no password: this user authenticates via OTP only
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    '',
    ''
  ) on conflict (id) do nothing;

  -- Create the colaboradores profile linking this auth user to the CPF
  insert into public.colaboradores (id, cpf)
  values (v_user_id, v_cpf)
  on conflict (id) do nothing;
end $$;
```

- [ ] **Step 2: Apply the migration**

```bash
supabase db push --local
```

Expected: migration applied. Verify with:

```bash
supabase db query "select id, cpf from colaboradores" --local
```

Expected output: one row with `b0000000-0000-0000-0000-000000000099` and `11111111111`.

- [ ] **Step 3: Commit**

```bash
git -C ../maia-db add supabase/migrations/020_seed_portal.sql
git -C ../maia-db commit -m "feat(db): dev seed portal test user"
```

---

## Task 3: Regenerate TypeScript types

**Repo:** maia-app

**Files:**
- Modify: `lib/supabase/database.types.ts`

- [ ] **Step 1: Regenerate**

```bash
supabase gen types typescript --local > lib/supabase/database.types.ts
```

- [ ] **Step 2: Verify the new table appears**

```bash
grep -n "colaboradores\|portal_saudacao\|portal_vazio\|portal_banner" lib/supabase/database.types.ts
```

Expected: `colaboradores` table block and the three portal copy column names appear.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/database.types.ts
git commit -m "chore: regen types after migration 019"
```

---

## Task 4: `lib/portal-auth.ts` + unit tests (TDD)

**Files:**
- Create: `tests/unit/portal-auth.test.ts`
- Create: `lib/portal-auth.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/portal-auth.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server");

import { requireColaborador } from "@/lib/portal-auth";
import { getSupabaseServer } from "@/lib/supabase/server";

const mockGetSupabaseServer = vi.mocked(getSupabaseServer);

const FAKE_USER = { id: "user-123" } as User;

function makeClient({
  user,
  colaboradorCpf,
}: {
  user: User | null;
  colaboradorCpf: string | null;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: colaboradorCpf ? { cpf: colaboradorCpf } : null,
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as Awaited<ReturnType<typeof getSupabaseServer>>;
}

describe("requireColaborador", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns unauthenticated when no session", async () => {
    mockGetSupabaseServer.mockResolvedValue(makeClient({ user: null, colaboradorCpf: null }));
    const result = await requireColaborador();
    expect(result.status).toBe("unauthenticated");
  });

  it("returns no_profile when session exists but no colaboradores row", async () => {
    mockGetSupabaseServer.mockResolvedValue(makeClient({ user: FAKE_USER, colaboradorCpf: null }));
    const result = await requireColaborador();
    expect(result.status).toBe("no_profile");
    if (result.status === "no_profile") {
      expect(result.user.id).toBe("user-123");
    }
  });

  it("returns ok with cpf when colaboradores row exists", async () => {
    mockGetSupabaseServer.mockResolvedValue(
      makeClient({ user: FAKE_USER, colaboradorCpf: "11111111111" }),
    );
    const result = await requireColaborador();
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.cpf).toBe("11111111111");
      expect(result.user.id).toBe("user-123");
    }
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run tests/unit/portal-auth.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/portal-auth'".

- [ ] **Step 3: Write the implementation**

Create `lib/portal-auth.ts`:

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
    .eq("id", user.id)
    .single();

  if (!data) return { status: "no_profile", user };
  return { status: "ok", user, cpf: data.cpf };
}
```

- [ ] **Step 4: Run to confirm all tests pass**

```bash
npx vitest run tests/unit/portal-auth.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Run full unit suite to check for regressions**

```bash
npx vitest run --exclude "**/e2e/**"
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/portal-auth.ts tests/unit/portal-auth.test.ts
git commit -m "feat: requireColaborador helper + tests"
```

---

## Task 5: `lib/portal-cadastro.ts` + unit tests + API route

**Files:**
- Create: `tests/unit/portal-cadastro-validation.test.ts`
- Create: `lib/portal-cadastro.ts`
- Create: `app/api/portal/cadastro/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/portal-cadastro-validation.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin");

import { processCadastro } from "@/lib/portal-cadastro";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const mockGetAdmin = vi.mocked(getSupabaseAdmin);
const VALID_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function makeAdmin({
  afastamentosCount,
  colaboradorExists = false,
}: {
  afastamentosCount: number;
  colaboradorExists?: boolean;
}) {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  mockGetAdmin.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "afastamentos") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: afastamentosCount, error: null }),
          }),
        };
      }
      // colaboradores table
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: colaboradorExists ? { id: VALID_USER_ID } : null,
              error: null,
            }),
          }),
        }),
        insert: mockInsert,
      };
    }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
  return { mockInsert };
}

describe("processCadastro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for non-numeric CPF", async () => {
    const result = await processCadastro(VALID_USER_ID, "1234abc4567");
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/11 dígitos/);
  });

  it("returns 400 for CPF shorter than 11 digits", async () => {
    const result = await processCadastro(VALID_USER_ID, "1234567890");
    expect(result.status).toBe(400);
  });

  it("returns 422 when CPF not found in afastamentos", async () => {
    makeAdmin({ afastamentosCount: 0 });
    const result = await processCadastro(VALID_USER_ID, "99999999999");
    expect(result.status).toBe(422);
    expect(result.error).toMatch(/não encontrado/);
  });

  it("returns 200 and inserts when CPF found", async () => {
    const { mockInsert } = makeAdmin({ afastamentosCount: 2 });
    const result = await processCadastro(VALID_USER_ID, "11111111111");
    expect(result.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith({ id: VALID_USER_ID, cpf: "11111111111" });
  });

  it("returns 200 without inserting when already registered (idempotent)", async () => {
    const { mockInsert } = makeAdmin({ afastamentosCount: 1, colaboradorExists: true });
    const result = await processCadastro(VALID_USER_ID, "11111111111");
    expect(result.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run tests/unit/portal-cadastro-validation.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/portal-cadastro'".

- [ ] **Step 3: Write `lib/portal-cadastro.ts`**

```ts
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const CPF_REGEX = /^\d{11}$/;

export async function processCadastro(
  userId: string,
  cpf: string,
): Promise<{ status: 200 | 400 | 422 | 500; error?: string }> {
  if (!CPF_REGEX.test(cpf)) {
    return { status: 400, error: "CPF deve ter 11 dígitos numéricos" };
  }

  const admin = getSupabaseAdmin();

  const { count } = await admin
    .from("afastamentos")
    .select("id", { count: "exact", head: true })
    .eq("cpf", cpf);

  if (!count) {
    return { status: 422, error: "CPF não encontrado nos nossos registros." };
  }

  const { data: existing } = await admin
    .from("colaboradores")
    .select("id")
    .eq("id", userId)
    .single();

  if (existing) return { status: 200 };

  const { error } = await admin
    .from("colaboradores")
    .insert({ id: userId, cpf });

  if (error) return { status: 500, error: error.message };
  return { status: 200 };
}
```

- [ ] **Step 4: Run to confirm tests pass**

```bash
npx vitest run tests/unit/portal-cadastro-validation.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Write `app/api/portal/cadastro/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { processCadastro } from "@/lib/portal-cadastro";

const Schema = z.object({ cpf: z.string() });

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const result = await processCadastro(user.id, parsed.data.cpf);
  return NextResponse.json(
    result.error ? { error: result.error } : { ok: true },
    { status: result.status },
  );
}
```

- [ ] **Step 6: Run full unit suite**

```bash
npx vitest run --exclude "**/e2e/**"
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/portal-cadastro.ts app/api/portal/cadastro/route.ts tests/unit/portal-cadastro-validation.test.ts
git commit -m "feat: processCadastro logic + API route + tests"
```

---

## Task 6: Middleware extension

**Files:**
- Modify: `middleware.ts`

Read `middleware.ts` in full before editing. The current file is:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const protectedPrefixes = ["/painel", "/afastamentos", "/ocorrencias", "/admin"];
  const isProtected = protectedPrefixes.some(p => path === p || path.startsWith(p + "/"));
  // Exceção pública: /afastamentos/editar/[token] é sem auth.
  const isPublicEdit = path.startsWith("/afastamentos/editar/");

  if (isProtected && !isPublicEdit && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|forms/|api/public/).*)"],
};
```

- [ ] **Step 1: Add portal protection**

Insert the following block immediately **before** the final `return response;` in the middleware function (after the existing `if (isProtected && !isPublicEdit && !user)` block):

```ts
  // Portal: /portal/login and /portal/cadastro are public; everything else requires auth.
  const isPortalPublic =
    path.startsWith("/portal/login") || path.startsWith("/portal/cadastro");
  const isPortal = path === "/portal" || path.startsWith("/portal/");

  if (isPortal && !isPortalPublic && !user) {
    return NextResponse.redirect(new URL("/portal/login", request.url));
  }
```

The file should now end with these two `if` blocks followed by `return response;`.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: protect /portal routes in middleware"
```

---

## Task 7: `(portal-public)` layout + login page

**Files:**
- Create: `app/(portal-public)/layout.tsx`
- Create: `app/(portal-public)/portal/login/page.tsx`

- [ ] **Step 1: Create the centering layout**

Create `app/(portal-public)/layout.tsx` — identical centering to `(auth)/layout.tsx`:

```tsx
export default function PortalPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--color-bg-subtle)] to-[var(--brand-primary-50)] p-4 sm:p-6">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create the login page**

Create `app/(portal-public)/portal/login/page.tsx`:

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

const EmailSchema = z.object({ email: z.string().email("Email inválido") });
const OtpSchema = z.object({
  code: z.string().length(6, "O código tem exatamente 6 dígitos"),
});

type EmailInput = z.infer<typeof EmailSchema>;
type OtpInput = z.infer<typeof OtpSchema>;
type Step = "email" | "otp";

const PITCH = {
  headingWords: ["Seus", "afastamentos,", "sempre", "acessíveis."],
  accentIndex: 1,
  sub: "Consulte o status dos seus afastamentos registrados na ENGEKO a qualquer hora.",
} as const;

export default function PortalLoginPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const emailForm = useForm<EmailInput>({
    resolver: zodResolver(EmailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<OtpInput>({
    resolver: zodResolver(OtpSchema),
    defaultValues: { code: "" },
  });

  async function onEmailSubmit(values: EmailInput) {
    setError(null);
    const supabase = getSupabaseBrowser();
    await supabase.auth.signInWithOtp({
      email: values.email,
      options: { shouldCreateUser: true },
    });
    // Always advance — prevents email enumeration.
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
        step === "email"
          ? "Digite seu email para receber o código de acesso."
          : `Enviamos um código de 6 dígitos para ${email}.`
      }
      pitch={PITCH}
    >
      {step === "email" ? (
        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <FormField
              control={emailForm.control}
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
              disabled={emailForm.formState.isSubmitting}
            >
              {emailForm.formState.isSubmitting ? "Enviando…" : "Enviar código"}
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
              onClick={() => { setStep("email"); setError(null); }}
              className="w-full text-sm text-[var(--color-fg-muted)] hover:text-foreground"
            >
              Usar outro email
            </button>
          </form>
        </Form>
      )}
    </AuthCard>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(portal-public\)/layout.tsx app/\(portal-public\)/portal/login/page.tsx
git commit -m "feat: portal login page (email OTP, two-step)"
```

---

## Task 8: `(portal-public)` cadastro page

**Files:**
- Create: `app/(portal-public)/portal/cadastro/page.tsx`

- [ ] **Step 1: Create the cadastro page**

Create `app/(portal-public)/portal/cadastro/page.tsx`:

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

const Schema = z.object({
  cpf: z
    .string()
    .regex(/^\d{11}$/, "CPF deve ter exatamente 11 dígitos numéricos (sem pontos ou traços)"),
});

type FormInput = z.infer<typeof Schema>;

const PITCH = {
  headingWords: ["Um", "passo", "para", "começar."],
  accentIndex: 1,
  sub: "Informe seu CPF para vincular seus registros à sua conta e acessar o portal.",
} as const;

export default function PortalCadastroPage() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<FormInput>({
    resolver: zodResolver(Schema),
    defaultValues: { cpf: "" },
  });

  async function onSubmit(values: FormInput) {
    setServerError(null);
    const res = await fetch("/api/portal/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf: values.cpf }),
    });
    if (res.ok) {
      router.push("/portal/painel");
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setServerError(body.error ?? "Erro ao cadastrar. Tente novamente.");
  }

  return (
    <AuthCard
      title="Vincular CPF"
      lead="Informe seu CPF para acessar seus registros de afastamento."
      pitch={PITCH}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}
          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="11 dígitos sem pontos ou traços"
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
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Salvando…" : "Confirmar"}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(portal-public\)/portal/cadastro/page.tsx
git commit -m "feat: portal cadastro page (CPF linkage)"
```

---

## Task 9: `(portal)` layout + logout button

**Files:**
- Create: `components/portal/portal-logout-button.tsx`
- Create: `app/(portal)/layout.tsx`

- [ ] **Step 1: Create the logout button client component**

Create `components/portal/portal-logout-button.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function PortalLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      Sair
    </Button>
  );
}
```

- [ ] **Step 2: Create the layout**

Create `app/(portal)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo-mark";
import { requireColaborador } from "@/lib/portal-auth";
import { PortalLogoutButton } from "@/components/portal/portal-logout-button";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireColaborador();
  if (session.status === "unauthenticated") redirect("/portal/login");
  if (session.status === "no_profile") redirect("/portal/cadastro");

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

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/portal/portal-logout-button.tsx app/\(portal\)/layout.tsx
git commit -m "feat: portal layout with auth gate and minimal shell"
```

---

## Task 10: `/portal` redirect + `/portal/painel` page

**Files:**
- Create: `app/(portal)/portal/page.tsx`
- Create: `app/(portal)/portal/painel/page.tsx`

- [ ] **Step 1: Create the root portal redirect**

Create `app/(portal)/portal/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function PortalRootPage() {
  redirect("/portal/painel");
}
```

- [ ] **Step 2: Create the painel page**

Create `app/(portal)/portal/painel/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { requireColaborador } from "@/lib/portal-auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { StatusPill } from "@/components/data/status-pill";
import { EmptyState } from "@/components/data/empty-state";

type AfastamentoRow = {
  id: string;
  situacao: string;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  colaborador_nome: string | null;
  afastamento_tipos: { rotulo: string };
  empresas: { nome: string };
};

const COLUMNS: DataTableColumn<AfastamentoRow>[] = [
  { key: "tipo", label: "Tipo", render: (r) => r.afastamento_tipos.rotulo },
  { key: "inicio", label: "Início", render: (r) => r.data_inicio, mono: true },
  { key: "fim", label: "Fim", render: (r) => r.data_fim ?? "—", mono: true },
  { key: "duracao", label: "Duração", render: (r) => (r.duracao ? `${r.duracao} dias` : "—") },
  {
    key: "situacao",
    label: "Situação",
    render: (r) => <StatusPill domain="afastamento" situacao={r.situacao} />,
  },
];

export default async function PortalPainelPage() {
  const session = await requireColaborador();
  if (session.status !== "ok") redirect("/portal/login");

  const supabase = await getSupabaseServer();

  const [{ data: config }, { data: rows }] = await Promise.all([
    supabase
      .from("configuracoes")
      .select("portal_saudacao, portal_vazio, portal_banner")
      .eq("id", 1)
      .single(),
    supabase
      .from("afastamentos")
      .select(
        "id, situacao, data_inicio, data_fim, duracao, colaborador_nome, afastamento_tipos!inner(rotulo), empresas!inner(nome)",
      )
      .eq("cpf", session.cpf)
      .order("criado_em", { ascending: false })
      .returns<AfastamentoRow[]>(),
  ]);

  const nome = rows?.[0]?.colaborador_nome ?? "colaborador";
  const saudacao = (config?.portal_saudacao ?? "Olá, {nome}.").replace("{nome}", nome);
  const banner = config?.portal_banner ?? "";
  const textoVazio = config?.portal_vazio ?? "Nenhum afastamento registrado.";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{saudacao}</h1>
        {banner && <p className="text-sm text-[var(--color-fg-muted)]">{banner}</p>}
      </header>
      <DataTable
        rows={rows ?? []}
        columns={COLUMNS}
        getRowId={(r) => r.id}
        getRowHref={(r) => `/portal/afastamentos/${r.id}`}
        empty={<EmptyState icon={FileText} title={textoVazio} />}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(portal\)/portal/page.tsx app/\(portal\)/portal/painel/page.tsx
git commit -m "feat: portal painel page with DataTable and portal copy"
```

---

## Task 11: `/portal/afastamentos/[id]` detail page

**Files:**
- Create: `app/(portal)/portal/afastamentos/[id]/page.tsx`

- [ ] **Step 1: Create the detail page**

Create `app/(portal)/portal/afastamentos/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireColaborador } from "@/lib/portal-auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { FieldGrid, type Field } from "@/components/detail/field-grid";
import { StatusPill } from "@/components/data/status-pill";

type DetailRow = {
  id: string;
  situacao: string;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  colaborador_nome: string | null;
  motivo_rejeicao: string | null;
  afastamento_tipos: { rotulo: string };
  empresas: { nome: string };
  unidades: { nome: string };
};

export default async function PortalAfastamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireColaborador();
  if (session.status !== "ok") redirect("/portal/login");

  const supabase = await getSupabaseServer();
  const { data: row } = await supabase
    .from("afastamentos")
    .select(
      "id, situacao, data_inicio, data_fim, duracao, colaborador_nome, motivo_rejeicao, afastamento_tipos!inner(rotulo), empresas!inner(nome), unidades!inner(nome)",
    )
    .eq("id", id)
    .single<DetailRow>();

  // RLS returns null if CPF does not match — treat as not found.
  if (!row) notFound();

  const fields: Field[] = [
    { label: "Tipo", value: row.afastamento_tipos.rotulo },
    { label: "Empresa", value: row.empresas.nome },
    { label: "Unidade", value: row.unidades.nome },
    { label: "Início", value: row.data_inicio, mono: true },
    { label: "Fim", value: row.data_fim ?? "—", mono: true },
    { label: "Duração", value: row.duracao ? `${row.duracao} dias` : "—" },
    { label: "Situação", value: <StatusPill domain="afastamento" situacao={row.situacao} /> },
    ...(row.situacao === "rejeitado" && row.motivo_rejeicao
      ? [{ label: "Motivo da rejeição", value: row.motivo_rejeicao, full: true as const }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/portal/painel" className="hover:text-foreground">
            Minha Área
          </Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">
            Afastamento
          </span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Detalhes do afastamento</h1>
      </header>

      <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
        <FieldGrid fields={fields} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add 'app/(portal)/portal/afastamentos/[id]/page.tsx'
git commit -m "feat: portal afastamento detail page (simplified status view)"
```

---

## Task 12: Admin configuracoes extension

**Files:**
- Modify: `app/(admin)/admin/configuracoes/page.tsx`
- Modify: `app/api/admin/configuracoes/route.ts`

Read both files in full before editing.

- [ ] **Step 1: Extend the API route's PATCH schema**

In `app/api/admin/configuracoes/route.ts`, replace the current `Patch` schema:

```ts
const Patch = z.object({ email_folha: z.string().email() });
```

with:

```ts
const Patch = z.object({
  email_folha:     z.string().email().optional(),
  portal_saudacao: z.string().min(1).optional(),
  portal_vazio:    z.string().min(1).optional(),
  portal_banner:   z.string().min(1).optional(),
});
```

The `update` call already spreads `parsed.data`, so partial updates work automatically — no further change needed to the handler body.

- [ ] **Step 2: Extend the configuracoes page**

In `app/(admin)/admin/configuracoes/page.tsx`:

Add three new state variables after `emailFolha`:
```ts
  const [portalSaudacao, setPortalSaudacao] = React.useState("");
  const [portalVazio, setPortalVazio] = React.useState("");
  const [portalBanner, setPortalBanner] = React.useState("");
```

In the `useEffect` fetch, extend the state initialization:
```ts
      .then((c) => {
        setEmailFolha(c?.email_folha ?? "");
        setPortalSaudacao(c?.portal_saudacao ?? "");
        setPortalVazio(c?.portal_vazio ?? "");
        setPortalBanner(c?.portal_banner ?? "");
      })
```

In the `save` function, include the new fields:
```ts
      body: JSON.stringify({
        email_folha: emailFolha,
        portal_saudacao: portalSaudacao,
        portal_vazio: portalVazio,
        portal_banner: portalBanner,
      }),
```

Add a new `<section>` after the existing "Notificações" section:

```tsx
      <section className="max-w-2xl rounded-md border border-[var(--color-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Portal do Colaborador
        </h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="portal-saudacao">Saudação</Label>
            <Input
              id="portal-saudacao"
              value={portalSaudacao}
              onChange={(e) => setPortalSaudacao(e.target.value)}
              placeholder="Olá, {nome}."
            />
            <p className="text-xs text-[var(--color-fg-muted)]">
              Use <code>{"{nome}"}</code> para substituir pelo nome do colaborador.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="portal-banner">Banner</Label>
            <Input
              id="portal-banner"
              value={portalBanner}
              onChange={(e) => setPortalBanner(e.target.value)}
              placeholder="Consulte o status dos seus afastamentos..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="portal-vazio">Mensagem de lista vazia</Label>
            <Input
              id="portal-vazio"
              value={portalVazio}
              onChange={(e) => setPortalVazio(e.target.value)}
              placeholder="Nenhum afastamento registrado para o seu CPF."
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={busy}>Salvar</Button>
        </div>
      </section>
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run the unit tests**

```bash
npx vitest run --exclude "**/e2e/**"
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/admin/configuracoes/page.tsx app/api/admin/configuracoes/route.ts
git commit -m "feat: admin configuracoes — portal copy fields"
```

---

## Task 13: E2E Phase 8 arc

**Files:**
- Modify: `tests/e2e/happy-path.spec.ts`

This task adds a gated Phase 8 arc to the existing E2E file. The arc authenticates as the seeded portal user by generating an admin magic link (bypasses the OTP step for testing), then verifies the portal pages.

**Prerequisites:**
- `SUPABASE_SERVICE_ROLE_KEY` env var must be set (printed by `supabase start`)
- `NEXT_PUBLIC_SUPABASE_URL` env var must be set (already used by the app)
- The dev seed user `colaborador@seed.local` must exist (migration 020)

Read `tests/e2e/happy-path.spec.ts` in full first to understand the existing structure and append after the Phase 6 block.

- [ ] **Step 1: Add the Phase 8 block**

Append to `tests/e2e/happy-path.spec.ts` (after the closing `});` of the Phase 6 block):

```ts
test.describe("Phase 8 portal", () => {
  test.skip(!process.env.E2E_PORTAL, "set E2E_PORTAL=1 to run");

  test("colaborador sees own afastamentos and detail view", async ({ page }) => {
    // Bypass OTP in tests: use admin API to generate a magic link for the seeded user,
    // then navigate to it with next=/portal/painel so auth/confirm redirects there.
    const { createClient } = await import("@supabase/supabase-js");
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: "colaborador@seed.local",
    });
    if (error || !data?.properties?.action_link) {
      throw new Error(`Failed to generate portal login link: ${error?.message}`);
    }

    // Inject next=/portal/painel so auth/confirm redirects to the portal.
    const confirmUrl = new URL(data.properties.action_link);
    confirmUrl.searchParams.set("next", "/portal/painel");

    await page.goto(confirmUrl.toString());
    await expect(page).toHaveURL(/\/portal\/painel/, { timeout: 10_000 });

    // Assert greeting and list render.
    // The seeded CPF 11111111111 = Ana Silva (from 017_seed_dev.sql).
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ana Silva");
    const dataRows = page.getByRole("row").filter({ hasNot: page.getByRole("columnheader") });
    await expect(dataRows).not.toHaveCount(0);

    // Click the first row link to reach the detail page.
    await page.getByRole("link").filter({ hasText: /Doença|Acidente/ }).first().click();
    await expect(page).toHaveURL(/\/portal\/afastamentos\/[a-f0-9-]+/);

    // Assert status detail renders.
    await expect(page.getByText(/Pendente|Finalizado|Rejeitado|Cancelado/)).toBeVisible();

    // Assert no medical/sensitive fields appear.
    await expect(page.getByText(/\bCID\b/i)).not.toBeVisible();
    await expect(page.getByText(/\bINSS\b/i)).not.toBeVisible();
    await expect(page.getByText(/Internação/i)).not.toBeVisible();

    // Assert no approval bar or admin controls.
    await expect(page.getByRole("button", { name: /Aprovar|Rejeitar/i })).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Run unit tests to confirm no regressions**

```bash
npx vitest run --exclude "**/e2e/**"
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/happy-path.spec.ts
git commit -m "test(e2e): Phase 8 gated portal arc"
```

---

## Task 14: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Full unit test run**

```bash
npx vitest run --exclude "**/e2e/**"
```

Expected: all tests pass (count should be ≥ 107: prior 99 + 3 portal-auth + 5 portal-cadastro).

- [ ] **Step 3: Build check**

```bash
npx next build 2>&1 | tail -30
```

Expected: build completes, no type errors. Verify these routes appear in the output:
- `/portal/login`
- `/portal/cadastro`
- `/portal/painel`
- `/portal/afastamentos/[id]`
- `/api/portal/cadastro`

- [ ] **Step 4: Commit (if any lint fixes needed)**

```bash
git add -p
git commit -m "chore: Phase 8 final cleanup"
```

- [ ] **Step 5: Update umbrella spec**

In `docs/superpowers/specs/2026-05-14-feature-expansion-design.md`, update the Phase 8 status line to:

```
**Status:** ✅ Complete (maia-app: <first-SHA>..<last-SHA>; maia-db: <first-SHA>..<last-SHA>).
```

Replace `<first-SHA>` / `<last-SHA>` with the actual git SHAs from each repo.

```bash
git add docs/superpowers/specs/2026-05-14-feature-expansion-design.md
git commit -m "docs(phase-8): mark complete in umbrella spec"
```
