# Portal Colaborador — Custom CPF+OTP Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Supabase Auth OTP flow in the colaborador portal with a fully custom CPF+email OTP system — OTP stored in DB, email sent via Resend, session tracked via httpOnly cookie — with zero Supabase Auth involvement.

**Architecture:** `login-init` validates CPF+email and sends a 6-digit OTP via Resend; `login-verify` checks the OTP, upserts the `colaboradores` row, creates a random session token in `portal_sessions`, and sets an httpOnly cookie. Portal server components read that cookie and query afastamentos using the service-role client (no RLS on portal paths — the `.eq("cpf", ...)` filter is the security boundary). The `colaboradores` table loses its `auth_id` column entirely and becomes a pure CPF registry.

**Tech Stack:** Next.js 15 App Router, Supabase (service-role client only for portal), Resend via `sendMail()`, Node.js `crypto` (randomInt + randomBytes), Vitest

---

## File Map

### maia-db — new migrations
| File | Purpose |
|------|---------|
| `supabase/migrations/026_portal_custom_auth.sql` | Drop auth deps; create `portal_otp_codes`, `portal_sessions` |
| `supabase/migrations/027_seed_portal_v3.sql` | Re-seed portal colaborador without `auth_id` |

### maia-app — new files
| File | Purpose |
|------|---------|
| `lib/portal-session.ts` | Create / get / delete portal sessions |
| `emails/portal-otp.ts` | OTP email template |
| `app/api/portal/login-verify/route.ts` | Verify OTP → upsert colaborador → create session → set cookie |
| `app/api/portal/logout/route.ts` | Delete session → clear cookie |

### maia-app — modify
| File | Change |
|------|--------|
| `lib/portal-auth.ts` | Rewrite: read cookie → query `portal_sessions` via admin client |
| `lib/mail/send.ts` | Add `portal-otp` template |
| `app/api/portal/login-init/route.ts` | Generate OTP, upsert `portal_otp_codes`, send via Resend |
| `app/(portal-public)/portal/login/page.tsx` | Call `/api/portal/login-verify` instead of Supabase auth OTP |
| `app/(portal)/layout.tsx` | Use `requirePortalSession()` |
| `app/(portal)/portal/painel/page.tsx` | Query via admin client (service-role) |
| `app/(portal)/portal/afastamentos/[id]/page.tsx` | Query via admin client (service-role) |
| `components/portal/portal-logout-button.tsx` | Call `POST /api/portal/logout` |
| `middleware.ts` | Remove Supabase auth check for portal routes |
| `tests/unit/portal-auth.test.ts` | Rewrite for new `requirePortalSession` API |

### maia-app — delete
- `lib/portal-register.ts`

---

## Task 1: DB migration — drop auth deps, add OTP + session tables

**Files:**
- Create: `/Users/heizen/DEV/maia-db/supabase/migrations/026_portal_custom_auth.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 026_portal_custom_auth.sql
-- Replace Supabase-Auth-coupled portal auth with a custom OTP + session scheme.
-- colaboradores no longer references auth.users; sessions are tracked in portal_sessions.

-- 1. Drop everything that depended on auth.uid() for portal access.
drop policy if exists colaboradores_self_read on colaboradores;
drop policy if exists afastamentos_colaborador_read on afastamentos;
drop function if exists colaborador_cpf(uuid);

-- 2. Drop auth_id from colaboradores (no longer needed).
alter table colaboradores drop column if exists auth_id;

-- 3. OTP codes table — one code per (cpf, email), expires in 10 min.
create table portal_otp_codes (
  id         bigint generated always as identity primary key,
  cpf        text        not null,
  email      text        not null,
  code       text        not null,
  expires_at timestamptz not null,
  used       boolean     not null default false,
  criado_em  timestamptz not null default now()
);
create index portal_otp_codes_lookup on portal_otp_codes(cpf, code) where not used;

-- 4. Session table — token is a 64-char hex string (32 random bytes).
create table portal_sessions (
  token      text        primary key,
  cpf        text        not null,
  expires_at timestamptz not null,
  criado_em  timestamptz not null default now()
);
create index portal_sessions_expires on portal_sessions(expires_at);

-- 5. Both tables are service-role-only (no RLS needed; anon never touches them).
-- RLS stays disabled on these tables by design.
```

- [ ] **Step 2: Apply and verify**

```bash
cd /Users/heizen/DEV/maia-db && supabase db reset
```

Expected: migration applies without error; `\d colaboradores` shows no `auth_id` column; `\dt portal_*` shows `portal_otp_codes` and `portal_sessions`.

- [ ] **Step 3: Commit**

```bash
cd /Users/heizen/DEV/maia-db
git add supabase/migrations/026_portal_custom_auth.sql
git commit -m "feat(db): custom portal auth — OTP codes + session tables, drop auth.users deps"
```

---

## Task 2: Re-seed portal colaborador (no auth_id)

**Files:**
- Create: `/Users/heizen/DEV/maia-db/supabase/migrations/027_seed_portal_v3.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 027_seed_portal_v3.sql
-- Re-seed portal colaborador after migration 026 dropped auth_id.
-- CPF 11111111111 = Ana Silva; matches afastamento in 017_seed_dev.sql.
-- DO NOT APPLY IN PRODUCTION.

insert into public.colaboradores (cpf, email)
values ('11111111111', 'colaborador@seed.local')
on conflict (cpf) do update set email = excluded.email;
```

- [ ] **Step 2: Apply and verify**

```bash
cd /Users/heizen/DEV/maia-db && supabase db reset
```

Expected: `select cpf, email from colaboradores;` returns one row with `11111111111` / `colaborador@seed.local`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/027_seed_portal_v3.sql
git commit -m "chore(db): re-seed portal colaborador without auth_id (migration 026)"
```

---

## Task 3: `lib/portal-session.ts` — session CRUD

**Files:**
- Create: `/Users/heizen/DEV/maia-app/lib/portal-session.ts`

- [ ] **Step 1: Write the unit test first**

Create `/Users/heizen/DEV/maia-app/tests/unit/portal-session.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin");

import { createPortalSession, getPortalSession, deletePortalSession } from "@/lib/portal-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const mockAdmin = vi.mocked(getSupabaseAdmin);

function makeAdminClient(overrides: Record<string, unknown> = {}) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const select = vi.fn();
  const del = vi.fn();
  const eqForSelect = vi.fn().mockReturnValue({
    gt: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { cpf: "11111111111" },
        error: null,
      }),
    }),
  });
  const eqForDelete = vi.fn().mockReturnValue({ error: null });

  select.mockReturnValue({ eq: eqForSelect });
  del.mockReturnValue({ eq: eqForDelete });

  return {
    from: vi.fn().mockImplementation((table: string) => ({
      insert,
      select,
      delete: del,
    })),
    ...overrides,
  } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

describe("portal-session", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createPortalSession returns a 64-char hex token", async () => {
    const client = makeAdminClient();
    mockAdmin.mockReturnValue(client);
    const token = await createPortalSession("11111111111");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("getPortalSession returns cpf for a valid token", async () => {
    const client = makeAdminClient();
    mockAdmin.mockReturnValue(client);
    const cpf = await getPortalSession("sometoken");
    expect(cpf).toBe("11111111111");
  });

  it("getPortalSession returns null when no row found", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>;
    mockAdmin.mockReturnValue(client);
    const cpf = await getPortalSession("badtoken");
    expect(cpf).toBeNull();
  });

  it("deletePortalSession calls delete with the token", async () => {
    const eqSpy = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({ eq: eqSpy }),
      }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>;
    mockAdmin.mockReturnValue(client);
    await deletePortalSession("tok123");
    expect(eqSpy).toHaveBeenCalledWith("token", "tok123");
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
cd /Users/heizen/DEV/maia-app && npx vitest run tests/unit/portal-session.test.ts
```

Expected: FAIL — module `@/lib/portal-session` not found.

- [ ] **Step 3: Implement `lib/portal-session.ts`**

```ts
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const SESSION_TTL_DAYS = 7;

export async function createPortalSession(cpf: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires_at = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("portal_sessions").insert({ token, cpf, expires_at });
  if (error) throw new Error(error.message);
  return token;
}

export async function getPortalSession(token: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("portal_sessions")
    .select("cpf")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data?.cpf ?? null;
}

export async function deletePortalSession(token: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from("portal_sessions").delete().eq("token", token);
}
```

- [ ] **Step 4: Run — verify it passes**

```bash
npx vitest run tests/unit/portal-session.test.ts
```

Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/portal-session.ts tests/unit/portal-session.test.ts
git commit -m "feat(portal): portal-session — create/get/delete session tokens"
```

---

## Task 4: Rewrite `lib/portal-auth.ts`

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/lib/portal-auth.ts`
- Modify: `/Users/heizen/DEV/maia-app/tests/unit/portal-auth.test.ts`

- [ ] **Step 1: Rewrite the test**

Replace the entire contents of `tests/unit/portal-auth.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
vi.mock("@/lib/portal-session");

import { requirePortalSession } from "@/lib/portal-auth";
import { cookies } from "next/headers";
import { getPortalSession } from "@/lib/portal-session";

const mockCookies = vi.mocked(cookies);
const mockGetPortalSession = vi.mocked(getPortalSession);

function makeCookieStore(token: string | undefined) {
  return { get: vi.fn().mockReturnValue(token ? { value: token } : undefined) } as unknown as Awaited<ReturnType<typeof cookies>>;
}

describe("requirePortalSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no cookie present", async () => {
    mockCookies.mockResolvedValue(makeCookieStore(undefined));
    const result = await requirePortalSession();
    expect(result).toBeNull();
    expect(mockGetPortalSession).not.toHaveBeenCalled();
  });

  it("returns null when session not found in DB", async () => {
    mockCookies.mockResolvedValue(makeCookieStore("sometoken"));
    mockGetPortalSession.mockResolvedValue(null);
    const result = await requirePortalSession();
    expect(result).toBeNull();
  });

  it("returns cpf when valid session found", async () => {
    mockCookies.mockResolvedValue(makeCookieStore("validtoken"));
    mockGetPortalSession.mockResolvedValue("11111111111");
    const result = await requirePortalSession();
    expect(result).toEqual({ cpf: "11111111111" });
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npx vitest run tests/unit/portal-auth.test.ts
```

Expected: FAIL — `requirePortalSession` not exported.

- [ ] **Step 3: Rewrite `lib/portal-auth.ts`**

```ts
import { cookies } from "next/headers";
import { getPortalSession } from "@/lib/portal-session";

export type PortalSession = { cpf: string };

export async function requirePortalSession(): Promise<PortalSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("portal_session")?.value;
  if (!token) return null;
  const cpf = await getPortalSession(token);
  if (!cpf) return null;
  return { cpf };
}
```

- [ ] **Step 4: Run — verify it passes**

```bash
npx vitest run tests/unit/portal-auth.test.ts
```

Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/portal-auth.ts tests/unit/portal-auth.test.ts
git commit -m "feat(portal): requirePortalSession — cookie-based, no Supabase auth"
```

---

## Task 5: OTP email template

**Files:**
- Create: `/Users/heizen/DEV/maia-app/emails/portal-otp.ts`

- [ ] **Step 1: Create the template**

```ts
import { layout } from "./_layout";

export function portalOtp(data: { code: string }): string {
  const body = `
    <p style="margin:16px 0;">Use o código abaixo para acessar a Área do Colaborador. Ele expira em <strong>10 minutos</strong>.</p>
    <div style="margin:24px 0;padding:20px;background:#f4f4f5;border-radius:8px;text-align:center;">
      <span style="font-size:36px;font-weight:700;letter-spacing:8px;font-variant-numeric:tabular-nums;">${data.code}</span>
    </div>
    <p style="margin:16px 0;font-size:13px;color:#71717a;">Se você não solicitou este código, ignore este email.</p>
  `;
  return layout("Seu código de acesso", body);
}
```

- [ ] **Step 2: Add to `lib/mail/send.ts` template registry**

Open `lib/mail/send.ts`. Add the import after the last import line:

```ts
import { portalOtp } from "@/emails/portal-otp";
```

Add the entry to the `TEMPLATES` object:

```ts
  "portal-otp": { subject: "Seu código de acesso — MAIA", render: (data: { code: string }) => portalOtp(data) },
```

- [ ] **Step 3: Commit**

```bash
git add emails/portal-otp.ts lib/mail/send.ts
git commit -m "feat(portal): portal-otp email template + register in sendMail"
```

---

## Task 6: Rewrite `app/api/portal/login-init/route.ts`

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/app/api/portal/login-init/route.ts`

This route now: validates CPF+email → checks `colaboradores` / `afastamentos` → generates OTP → upserts into `portal_otp_codes` → sends via Resend.

- [ ] **Step 1: Rewrite the route**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomInt } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mail/send";

const Schema = z.object({
  cpf:   z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos" }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { cpf, email } = parsed.data;
  const admin = getSupabaseAdmin();

  // Validate CPF: check colaboradores row (email must match if set) OR afastamentos history.
  const { data: colab } = await admin
    .from("colaboradores")
    .select("email")
    .eq("cpf", cpf)
    .maybeSingle();

  if (colab) {
    if (colab.email && colab.email.toLowerCase() !== email) {
      return NextResponse.json(
        { error: "Email não corresponde ao cadastro. Entre em contato com o RH." },
        { status: 403 },
      );
    }
  } else {
    // Not in colaboradores — check afastamentos history.
    const { count, error: countError } = await admin
      .from("afastamentos")
      .select("id", { count: "exact", head: true })
      .eq("cpf", cpf);
    if (countError) return NextResponse.json({ error: "Erro interno." }, { status: 500 });
    if (!count) {
      return NextResponse.json({ error: "CPF não encontrado nos nossos registros." }, { status: 404 });
    }
  }

  // Generate 6-digit OTP and store it (invalidate any existing unused codes for this CPF).
  const code = String(randomInt(100000, 999999));
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Mark all previous unused codes for this CPF as used.
  await admin
    .from("portal_otp_codes")
    .update({ used: true })
    .eq("cpf", cpf)
    .eq("used", false);

  const { error: insertError } = await admin
    .from("portal_otp_codes")
    .insert({ cpf, email, code, expires_at });
  if (insertError) return NextResponse.json({ error: "Erro interno." }, { status: 500 });

  try {
    await sendMail({ template: "portal-otp", to: email, data: { code } });
  } catch {
    return NextResponse.json({ error: "Não foi possível enviar o código. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/heizen/DEV/maia-app && npx tsc --noEmit 2>&1 | grep "login-init"
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add app/api/portal/login-init/route.ts
git commit -m "feat(portal): login-init — generate OTP, send via Resend"
```

---

## Task 7: New `app/api/portal/login-verify/route.ts`

**Files:**
- Create: `/Users/heizen/DEV/maia-app/app/api/portal/login-verify/route.ts`

This route: validates code → marks OTP used → upserts `colaboradores` row → creates session → sets httpOnly cookie.

- [ ] **Step 1: Create the route**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createPortalSession } from "@/lib/portal-session";

const Schema = z.object({
  cpf:   z.string().regex(/^\d{11}$/),
  email: z.string().trim().toLowerCase().email(),
  code:  z.string().length(6),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos" }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { cpf, email, code } = parsed.data;
  const admin = getSupabaseAdmin();

  // Find a valid, unused OTP for this CPF+email+code that has not expired.
  const { data: otp, error: otpError } = await admin
    .from("portal_otp_codes")
    .select("id")
    .eq("cpf", cpf)
    .eq("email", email)
    .eq("code", code)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (otpError) return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  if (!otp) {
    return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 401 });
  }

  // Mark OTP as used.
  await admin.from("portal_otp_codes").update({ used: true }).eq("id", otp.id);

  // Upsert colaboradores row (handles both first-time and returning colaboradores).
  await admin
    .from("colaboradores")
    .upsert({ cpf, email }, { onConflict: "cpf", ignoreDuplicates: false });

  // Create session and set cookie.
  const token = await createPortalSession(cpf);
  const cookieStore = await cookies();
  cookieStore.set("portal_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "login-verify"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/portal/login-verify/route.ts
git commit -m "feat(portal): login-verify — OTP check, colaboradores upsert, session cookie"
```

---

## Task 8: New `app/api/portal/logout/route.ts`

**Files:**
- Create: `/Users/heizen/DEV/maia-app/app/api/portal/logout/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deletePortalSession } from "@/lib/portal-session";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("portal_session")?.value;
  if (token) {
    await deletePortalSession(token);
  }
  cookieStore.set("portal_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/portal/logout/route.ts
git commit -m "feat(portal): logout route — delete session, clear cookie"
```

---

## Task 9: Rewrite `app/(portal-public)/portal/login/page.tsx`

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/app/(portal-public)/portal/login/page.tsx`

The page now calls `/api/portal/login-init` (step 1) and `/api/portal/login-verify` (step 2). No Supabase client involved.

- [ ] **Step 1: Rewrite the page**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-card";

const CredSchema = z.object({
  cpf:   z.string().regex(/^\d{11}$/, "CPF deve ter exatamente 11 dígitos"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
});
const OtpSchema = z.object({
  code: z.string().length(6, "O código tem exatamente 6 dígitos"),
});

type CredInput = z.infer<typeof CredSchema>;
type OtpInput  = z.infer<typeof OtpSchema>;
type Step      = "cred" | "otp";

const PITCH = {
  headingWords: ["Seus", "afastamentos,", "sempre", "acessíveis."],
  accentIndex: 1,
  sub: "Consulte o status dos seus afastamentos registrados na ENGEKO a qualquer hora.",
};

export default function PortalLoginPage() {
  const router = useRouter();
  const [step,  setStep]  = React.useState<Step>("cred");
  const [creds, setCreds] = React.useState<CredInput | null>(null);
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
    setCreds(values);
    setStep("otp");
  }

  async function onOtpSubmit(values: OtpInput) {
    setError(null);
    if (!creds) return;
    const res = await fetch("/api/portal/login-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf: creds.cpf, email: creds.email, code: values.code }),
    });
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "Erro inesperado." }));
      setError(msg ?? "Código inválido ou expirado. Tente novamente.");
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
          : `Enviamos um código de 6 dígitos para ${creds?.email}.`
      }
      pitch={PITCH}
    >
      {step === "cred" ? (
        <Form {...credForm}>
          <form onSubmit={credForm.handleSubmit(onCredSubmit)} className="space-y-4">
            {error && (
              <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
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
                    <Input type="text" inputMode="numeric" maxLength={11} placeholder="Somente números" autoComplete="username" {...field} />
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
            <Button type="submit" className="w-full border-b-[3px] border-[var(--brand-accent-500)]" disabled={credForm.formState.isSubmitting}>
              {credForm.formState.isSubmitting ? "Verificando…" : "Enviar código"}
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
            {error && (
              <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
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
                    <Input type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full border-b-[3px] border-[var(--brand-accent-500)]" disabled={otpForm.formState.isSubmitting}>
              {otpForm.formState.isSubmitting ? "Verificando…" : "Entrar"}
            </Button>
            <button
              type="button"
              onClick={() => { setStep("cred"); setError(null); setCreds(null); otpForm.reset(); }}
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

- [ ] **Step 2: Commit**

```bash
git add app/\(portal-public\)/portal/login/page.tsx
git commit -m "feat(portal): login page — custom OTP flow, no Supabase auth"
```

---

## Task 10: Rewrite `app/(portal)/layout.tsx`

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/app/(portal)/layout.tsx`

Remove `requireColaborador`, `autoRegisterColaborador` — use `requirePortalSession` instead.

- [ ] **Step 1: Rewrite the layout**

```tsx
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo-mark";
import { requirePortalSession } from "@/lib/portal-auth";
import { PortalLogoutButton } from "@/components/portal/portal-logout-button";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePortalSession();
  if (!session) redirect("/portal/login");

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

- [ ] **Step 2: Commit**

```bash
git add app/\(portal\)/layout.tsx
git commit -m "feat(portal): layout — requirePortalSession, drop Supabase auth deps"
```

---

## Task 11: Update portal data pages (service-role queries)

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/app/(portal)/portal/painel/page.tsx`
- Modify: `/Users/heizen/DEV/maia-app/app/(portal)/portal/afastamentos/[id]/page.tsx`

Both pages currently call `requireColaborador()` and use the anon Supabase client (relying on RLS). Now they call `requirePortalSession()` and query via `getSupabaseAdmin()`.

- [ ] **Step 1: Update `painel/page.tsx`**

Replace the top of the file — change the imports and the data-fetching section:

```tsx
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { requirePortalSession } from "@/lib/portal-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
  { key: "tipo",     label: "Tipo",     render: (r) => r.afastamento_tipos.rotulo },
  { key: "inicio",   label: "Início",   render: (r) => r.data_inicio, mono: true },
  { key: "fim",      label: "Fim",      render: (r) => r.data_fim ?? "—", mono: true },
  { key: "duracao",  label: "Duração",  render: (r) => (r.duracao ? `${r.duracao} dias` : "—") },
  {
    key: "situacao",
    label: "Situação",
    render: (r) => <StatusPill domain="afastamento" situacao={r.situacao} />,
  },
];

export default async function PortalPainelPage() {
  const session = await requirePortalSession();
  if (!session) redirect("/portal/login");

  const admin = getSupabaseAdmin();

  const [{ data: config }, { data: rows }] = await Promise.all([
    admin
      .from("configuracoes")
      .select("portal_saudacao, portal_vazio, portal_banner")
      .eq("id", 1)
      .single(),
    admin
      .from("afastamentos")
      .select(
        "id, situacao, data_inicio, data_fim, duracao, colaborador_nome, afastamento_tipos!inner(rotulo), empresas!inner(nome)",
      )
      .eq("cpf", session.cpf)
      .order("criado_em", { ascending: false })
      .returns<AfastamentoRow[]>(),
  ]);

  const nome = rows?.[0]?.colaborador_nome ?? "colaborador";
  const saudacao  = (config?.portal_saudacao ?? "Olá, {nome}.").replace("{nome}", nome);
  const banner    = config?.portal_banner ?? "";
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

- [ ] **Step 2: Update `afastamentos/[id]/page.tsx`**

Replace the imports and the data-fetching section:

```tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requirePortalSession } from "@/lib/portal-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { FieldGrid, type Field } from "@/components/detail/field-grid";
import { StatusPill } from "@/components/data/status-pill";

type DetailRow = {
  id: string;
  situacao: string;
  cpf: string;
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
  const session = await requirePortalSession();
  if (!session) redirect("/portal/login");

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("afastamentos")
    .select(
      "id, situacao, cpf, data_inicio, data_fim, duracao, colaborador_nome, motivo_rejeicao, afastamento_tipos!inner(rotulo), empresas!inner(nome), unidades!inner(nome)",
    )
    .eq("id", id)
    .single<DetailRow>();

  // Explicit CPF check replaces RLS — ensure this colaborador owns the record.
  if (!row || row.cpf !== session.cpf) notFound();

  const fields: Field[] = [
    { label: "Tipo",     value: row.afastamento_tipos.rotulo },
    { label: "Empresa",  value: row.empresas.nome },
    { label: "Unidade",  value: row.unidades.nome },
    { label: "Início",   value: row.data_inicio, mono: true },
    { label: "Fim",      value: row.data_fim ?? "—", mono: true },
    { label: "Duração",  value: row.duracao ? `${row.duracao} dias` : "—" },
    { label: "Situação", value: <StatusPill domain="afastamento" situacao={row.situacao} /> },
    ...(row.situacao === "rejeitado" && row.motivo_rejeicao
      ? [{ label: "Motivo da rejeição", value: row.motivo_rejeicao, full: true as const }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/portal/painel" className="hover:text-foreground">Minha Área</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Afastamento</span>
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

- [ ] **Step 3: Commit**

```bash
git add app/\(portal\)/portal/painel/page.tsx app/\(portal\)/portal/afastamentos/\[id\]/page.tsx
git commit -m "feat(portal): painel + detail — service-role queries, CPF from session cookie"
```

---

## Task 12: Rewrite `components/portal/portal-logout-button.tsx`

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/components/portal/portal-logout-button.tsx`

- [ ] **Step 1: Rewrite**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PortalLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
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

- [ ] **Step 2: Commit**

```bash
git add components/portal/portal-logout-button.tsx
git commit -m "feat(portal): logout button — call /api/portal/logout, no Supabase auth"
```

---

## Task 13: Update `middleware.ts`

**Files:**
- Modify: `/Users/heizen/DEV/maia-app/middleware.ts`

Remove the portal-specific Supabase auth check. The `(portal)/layout.tsx` handles portal auth via the session cookie. Middleware still protects staff routes.

- [ ] **Step 1: Remove portal check from middleware**

The section to remove is:

```ts
  // Portal: /portal/login is public; everything else requires auth.
  const isPortalPublic = path.startsWith("/portal/login");
  const isPortal = path === "/portal" || path.startsWith("/portal/");

  if (isPortal && !isPortalPublic && !user) {
    return NextResponse.redirect(new URL("/portal/login", request.url));
  }
```

Replace the entire middleware body with:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => request.cookies.set(name, value, options));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const protectedPrefixes = ["/painel", "/afastamentos", "/ocorrencias", "/admin"];
  const isProtected = protectedPrefixes.some(p => path === p || path.startsWith(p + "/"));
  const isPublicEdit = path.startsWith("/afastamentos/editar/");

  if (isProtected && !isPublicEdit && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Portal auth is handled by (portal)/layout.tsx via portal_session cookie.
  // No middleware check needed here.

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|forms/|api/public/).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "fix(middleware): remove portal Supabase auth check — handled by portal layout"
```

---

## Task 14: Cleanup

**Files:**
- Delete: `/Users/heizen/DEV/maia-app/lib/portal-register.ts`

- [ ] **Step 1: Delete portal-register.ts**

```bash
rm /Users/heizen/DEV/maia-app/lib/portal-register.ts
```

- [ ] **Step 2: Verify no remaining references**

```bash
grep -r "portal-register\|autoRegisterColaborador" /Users/heizen/DEV/maia-app/app /Users/heizen/DEV/maia-app/lib /Users/heizen/DEV/maia-app/components
```

Expected: no output.

- [ ] **Step 3: Verify full TypeScript build is clean**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Run all unit tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "chore(portal): delete portal-register.ts — no longer needed after custom auth"
```

---

## Manual end-to-end verification

After all tasks are complete:

1. `cd /Users/heizen/DEV/maia-db && supabase db reset` — migrations apply cleanly
2. `cd /Users/heizen/DEV/maia-app && npm run dev`
3. Visit `http://localhost:3000/portal/login`
4. Enter CPF `11111111111`, email `colaborador@seed.local` → click **Enviar código**
5. Verify Resend log shows the email (or check dev SMTP if `RESEND_API_KEY` is not set)
6. Enter the 6-digit code → click **Entrar**
7. Confirm redirect to `/portal/painel` showing Ana Silva's afastamentos
8. Click **Sair** → confirm redirect to `/portal/login` and no session cookie remains
9. Confirm staff login at `/login` with `admin@seed.local` still works and reaches the private app
