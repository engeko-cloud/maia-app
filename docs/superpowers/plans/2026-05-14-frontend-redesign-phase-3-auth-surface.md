# Frontend Redesign — Phase 3 (Auth Surface) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unstyled `<input>`-based auth pages with a branded split-card auth funnel: a new `(auth)` shell wrapping a shared `<AuthCard>` component, with `/login`, `/forgot-password`, and `/update-password` rewritten in react-hook-form + zod with inline validation and translated Supabase error messages.

**Architecture:** Three pure modules (zod schemas, Supabase-error translator) land first as the type contract. A server-component `<AuthCard>` owns the split-card layout (desktop) and stacked-banner variant (mobile) and accepts a typed `pitch` prop so the orange-accent word can land anywhere in the heading per page. Pages become client components that drive RHF + zod with inline `<FormMessage>` errors and a sibling alert above the form for Supabase-returned errors (no toasts on submit failure).

**Tech Stack:** Next.js 16 App Router (route groups), React 19 server components, Tailwind v4, shadcn 4.7 (`base-nova`, `@base-ui/react`), lucide-react, react-hook-form + `@hookform/resolvers/zod`, zod, Supabase JS browser client (`@supabase/ssr`), sonner (toast on success only), Vitest, Playwright.

**Parent spec:** `docs/superpowers/specs/2026-05-14-frontend-redesign-phase-3-auth-surface-design.md`.

---

## File Layout

```
app/
└── (auth)/
    ├── layout.tsx                       CREATE (Task 4)
    ├── login/page.tsx                   REWRITE (Task 5)
    ├── forgot-password/page.tsx         REWRITE (Task 6)
    └── update-password/page.tsx         REWRITE (Task 7)
components/
└── auth/
    └── auth-card.tsx                    CREATE (Task 3) — server
lib/
├── auth-schemas.ts                      CREATE (Task 1)
└── auth-errors.ts                       CREATE (Task 2)
tests/
├── unit/
│   ├── auth-schemas.test.ts             CREATE (Task 1)
│   └── auth-errors.test.ts              CREATE (Task 2)
└── e2e/
    └── auth-pages.spec.ts               CREATE (Task 8)
docs/superpowers/specs/2026-05-14-frontend-redesign-design.md  MODIFY (Task 9)
```

**Conventions established by prior phases:**

- shadcn primitives live in `components/ui/` and re-export from `@base-ui/react/*` (NOT Radix). `Button`, `Input`, `Label`, `Form` (RHF wrapper), `Field*` were installed in Phase 1.
- Server components by default. Pages owning RHF state declare `"use client"` at the top.
- Tailwind v4 with `@theme inline` in `app/tokens.css` maps CSS vars → utility classes. For brand vars not mapped (e.g., `--brand-accent-500`, `--brand-primary-600`), use bracket syntax: `bg-[var(--brand-accent-500)]`.
- The `cn` helper lives at `@/lib/utils`.
- Browser-side Supabase is `getSupabaseBrowser()` from `@/lib/supabase/client`.
- `<LogoMark>` from `@/components/brand/logo-mark` accepts `size?: "sm" | "md" | "lg"` and `muted?: boolean` (default `false`, which renders the orange→blue gradient mark with white "M").
- `APP_VERSION` from `@/lib/version` (created Phase 2).

---

## Task 1: zod schemas + their unit tests

**Files:**
- Create: `lib/auth-schemas.ts`
- Create: `tests/unit/auth-schemas.test.ts`

- [ ] **Step 1.1: Write the failing tests**

Create `tests/unit/auth-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  loginSchema,
  forgotPasswordSchema,
  updatePasswordSchema,
} from "@/lib/auth-schemas";

describe("loginSchema", () => {
  it("accepts a valid email + non-empty password", () => {
    const parsed = loginSchema.parse({
      email: "user@example.com",
      password: "anything",
    });
    expect(parsed.email).toBe("user@example.com");
    expect(parsed.password).toBe("anything");
  });

  it("trims whitespace and lowercases the email", () => {
    const parsed = loginSchema.parse({
      email: "  USER@Example.COM ",
      password: "x",
    });
    expect(parsed.email).toBe("user@example.com");
  });

  it("rejects a malformed email with the PT message", () => {
    const r = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Informe um email válido.");
    }
  });

  it("rejects an empty password with the PT message", () => {
    const r = loginSchema.safeParse({ email: "u@e.com", password: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === "Informe sua senha.")).toBe(true);
    }
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    const parsed = forgotPasswordSchema.parse({ email: "u@e.com" });
    expect(parsed.email).toBe("u@e.com");
  });

  it("rejects a malformed email", () => {
    const r = forgotPasswordSchema.safeParse({ email: "nope" });
    expect(r.success).toBe(false);
  });
});

describe("updatePasswordSchema", () => {
  it("accepts matching passwords of length >= 8", () => {
    const parsed = updatePasswordSchema.parse({
      password: "abcdefgh",
      confirm: "abcdefgh",
    });
    expect(parsed.password).toBe("abcdefgh");
  });

  it("rejects a password shorter than 8 chars", () => {
    const r = updatePasswordSchema.safeParse({ password: "short", confirm: "short" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some(
          (i) =>
            i.path[0] === "password" &&
            i.message === "A senha precisa ter ao menos 8 caracteres.",
        ),
      ).toBe(true);
    }
  });

  it("rejects mismatched confirm with the error on the confirm path", () => {
    const r = updatePasswordSchema.safeParse({
      password: "abcdefgh",
      confirm: "different",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === "confirm");
      expect(issue?.message).toBe("As senhas não coincidem.");
    }
  });
});
```

- [ ] **Step 1.2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/auth-schemas.test.ts`
Expected: FAIL with module resolution error (`Cannot find module '@/lib/auth-schemas'`).

- [ ] **Step 1.3: Implement the schemas**

Create `lib/auth-schemas.ts`:

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um email válido."),
  password: z.string().min(1, "Informe sua senha."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um email válido."),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "As senhas não coincidem.",
  });
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
```

- [ ] **Step 1.4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/auth-schemas.test.ts`
Expected: PASS (7 assertions across 7 tests).

- [ ] **Step 1.5: Commit**

```bash
git add lib/auth-schemas.ts tests/unit/auth-schemas.test.ts
git commit -m "feat(auth): zod schemas for login, forgot, update-password"
```

---

## Task 2: Supabase error translator + its unit tests

**Files:**
- Create: `lib/auth-errors.ts`
- Create: `tests/unit/auth-errors.test.ts`

- [ ] **Step 2.1: Write the failing tests**

Create `tests/unit/auth-errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { translateAuthError } from "@/lib/auth-errors";

describe("translateAuthError", () => {
  it("returns null for null input", () => {
    expect(translateAuthError(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(translateAuthError(undefined)).toBeNull();
  });

  it("translates 'Invalid login credentials'", () => {
    expect(translateAuthError({ message: "Invalid login credentials" })).toBe(
      "Email ou senha incorretos.",
    );
  });

  it("translates 'Email not confirmed'", () => {
    expect(translateAuthError({ message: "Email not confirmed" })).toBe(
      "Confirme seu email antes de entrar.",
    );
  });

  it("translates 'User not found'", () => {
    expect(translateAuthError({ message: "User not found" })).toBe(
      "Não encontramos uma conta com esse email.",
    );
  });

  it("translates 'Auth session missing!'", () => {
    expect(translateAuthError({ message: "Auth session missing!" })).toBe(
      "Sua sessão expirou. Solicite um novo link.",
    );
  });

  it("translates 'Password should be at least 6 characters.'", () => {
    expect(
      translateAuthError({ message: "Password should be at least 6 characters." }),
    ).toBe("A senha precisa ter ao menos 8 caracteres.");
  });

  it("translates 'New password should be different from the old password.'", () => {
    expect(
      translateAuthError({
        message: "New password should be different from the old password.",
      }),
    ).toBe("A nova senha precisa ser diferente da atual.");
  });

  it("returns the generic fallback for unknown messages", () => {
    expect(translateAuthError({ message: "Some random error" })).toBe(
      "Não foi possível concluir. Tente novamente.",
    );
  });
});
```

- [ ] **Step 2.2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/auth-errors.test.ts`
Expected: FAIL with module resolution error (`Cannot find module '@/lib/auth-errors'`).

- [ ] **Step 2.3: Implement the translator**

Create `lib/auth-errors.ts`:

```ts
const map: Record<string, string> = {
  "Invalid login credentials": "Email ou senha incorretos.",
  "Email not confirmed": "Confirme seu email antes de entrar.",
  "User not found": "Não encontramos uma conta com esse email.",
  "Auth session missing!": "Sua sessão expirou. Solicite um novo link.",
  "Password should be at least 6 characters.":
    "A senha precisa ter ao menos 8 caracteres.",
  "New password should be different from the old password.":
    "A nova senha precisa ser diferente da atual.",
};

export function translateAuthError(
  error: { message: string } | null | undefined,
): string | null {
  if (!error) return null;
  return map[error.message] ?? "Não foi possível concluir. Tente novamente.";
}
```

- [ ] **Step 2.4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/auth-errors.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 2.5: Commit**

```bash
git add lib/auth-errors.ts tests/unit/auth-errors.test.ts
git commit -m "feat(auth): translate Supabase auth errors to Portuguese"
```

---

## Task 3: `<AuthCard>` component

**Files:**
- Create: `components/auth/auth-card.tsx`

This component has no unit tests of its own — its render is exercised transitively by the page-level E2E render-smoke in Task 8.

- [ ] **Step 3.1: Create the component**

Create `components/auth/auth-card.tsx`:

```tsx
import * as React from "react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { APP_VERSION } from "@/lib/version";

export interface AuthCardPitch {
  /** Heading words; the word at `accentIndex` renders in the brand accent color. */
  headingWords: string[];
  /** Zero-based index into headingWords. */
  accentIndex: number;
  /** Sub-copy below the heading. */
  sub: string;
}

interface AuthCardProps {
  /** Form-column heading ("Entrar", "Recuperar senha", "Nova senha"). */
  title: string;
  /** One-line lead under the title. */
  lead: string;
  /** Brand-panel pitch (right side desktop, top banner mobile). */
  pitch: AuthCardPitch;
  children: React.ReactNode;
}

function PitchHeading({ pitch }: { pitch: AuthCardPitch }) {
  return (
    <h2 className="text-xl font-semibold leading-tight">
      {pitch.headingWords.map((word, i) => (
        <React.Fragment key={i}>
          {i > 0 && " "}
          <span
            className={
              i === pitch.accentIndex ? "text-[var(--brand-accent-500)]" : ""
            }
          >
            {word}
          </span>
        </React.Fragment>
      ))}
    </h2>
  );
}

function BrandStamp({ tone }: { tone: "light" | "dark" }) {
  const wordmarkClass =
    tone === "light"
      ? "text-sm font-semibold tracking-tight text-foreground"
      : "text-sm font-semibold tracking-tight text-white";
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <LogoMark size="sm" />
      <span className={wordmarkClass}>
        MAIA <span className="text-[var(--brand-accent-500)]">·</span> ENGEKO
      </span>
    </Link>
  );
}

export function AuthCard({ title, lead, pitch, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-[720px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-lg)]">
      <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1fr]">
        {/* Mobile-only brand banner (stacks above the form below md) */}
        <div className="relative flex items-center gap-3 bg-gradient-to-br from-[var(--brand-primary-600)] to-[var(--brand-primary-900)] p-5 md:hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, color-mix(in oklab, var(--brand-accent-500) 30%, transparent), transparent 60%)",
            }}
          />
          <div className="relative">
            <BrandStamp tone="dark" />
          </div>
        </div>

        {/* Form panel (left on desktop, below the banner on mobile) */}
        <div className="p-6 md:p-8">
          <BrandStamp tone="light" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{lead}</p>
          <div className="mt-6">{children}</div>
        </div>

        {/* Brand panel (desktop only — md and up) */}
        <div className="relative hidden flex-col bg-gradient-to-br from-[var(--brand-primary-600)] to-[var(--brand-primary-900)] p-8 text-white md:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, color-mix(in oklab, var(--brand-accent-500) 30%, transparent), transparent 60%)",
            }}
          />
          <div className="relative flex h-full flex-col">
            <PitchHeading pitch={pitch} />
            <div className="mt-3 h-[3px] w-12 rounded-full bg-[var(--brand-accent-500)]" />
            <p className="mt-4 text-sm text-white/80">{pitch.sub}</p>
            <p className="mt-auto pt-8 text-xs text-white/60">
              v{APP_VERSION}{" "}
              <span className="text-[var(--brand-accent-500)]">·</span> © 2026
              ENGEKO
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.2: Verify it type-checks via a build**

Run: `npm run build`
Expected: PASS. No new pages reference `<AuthCard>` yet, so the build passes simply because the file compiles.

- [ ] **Step 3.3: Commit**

```bash
git add components/auth/auth-card.tsx
git commit -m "feat(auth): AuthCard split-card shell with mobile banner variant"
```

---

## Task 4: `(auth)` shell layout

**Files:**
- Create: `app/(auth)/layout.tsx`

Note: a `layout.tsx` at the `(auth)` group level did not exist before — the three pages currently render inside `app/layout.tsx` directly. After this task they'll render inside the new gradient-backdrop wrapper. The existing unstyled pages (still untouched at this point) will end up briefly visible inside the new backdrop — that's fine; Tasks 5–7 replace them.

- [ ] **Step 4.1: Create the layout**

Create `app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({
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

- [ ] **Step 4.2: Verify the build still passes**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4.3: Commit**

```bash
git add app/\(auth\)/layout.tsx
git commit -m "feat(auth): centered gradient layout for auth shell"
```

---

## Task 5: Rewrite `/login`

**Files:**
- Modify: `app/(auth)/login/page.tsx` (full rewrite)

- [ ] **Step 5.1: Rewrite the page**

Replace the entire contents of `app/(auth)/login/page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { loginSchema, type LoginInput } from "@/lib/auth-schemas";
import { translateAuthError } from "@/lib/auth-errors";

export default function LoginPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setErrorMessage(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setErrorMessage(translateAuthError(error));
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  return (
    <AuthCard
      title="Entrar"
      lead="Acesse sua conta para gerenciar afastamentos e ocorrências."
      pitch={{
        headingWords: ["Saúde", "ocupacional,", "sem", "fricção."],
        accentIndex: 1,
        sub: "Aprovações, investigações e relatórios em um único painel — feito para a equipe de SST da ENGEKO.",
      }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          )}
          <FormField
            control={form.control}
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
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Senha</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    Esqueci a senha
                  </Link>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
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
            {form.formState.isSubmitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
```

- [ ] **Step 5.2: Manual smoke test**

Run: `npm run dev` (in a separate shell), then visit `http://localhost:3000/login`.

Verify by eye:
- Split card renders with form on the left, dark-blue brand panel with "Saúde **ocupacional,** sem fricção." on the right.
- Submitting empty form shows inline "Informe um email válido." and "Informe sua senha." under the fields.
- Submitting a valid-format but non-existent email like `nobody@example.com` with password `wrongpass` shows inline alert "Email ou senha incorretos." above the form (validates the wrong-credentials path through Supabase).
- Submit button has a thin orange line along its bottom edge.

Stop the dev server after verifying.

- [ ] **Step 5.3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5.4: Commit**

```bash
git add app/\(auth\)/login/page.tsx
git commit -m "feat(auth): rewrite /login with AuthCard + RHF + zod"
```

---

## Task 6: Rewrite `/forgot-password`

**Files:**
- Modify: `app/(auth)/forgot-password/page.tsx` (full rewrite)

- [ ] **Step 6.1: Rewrite the page**

Replace the entire contents of `app/(auth)/forgot-password/page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/auth-schemas";
import { translateAuthError } from "@/lib/auth-errors";

export default function ForgotPasswordPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setErrorMessage(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_BASE_URL ?? window.location.origin}/update-password`,
    });
    if (error) {
      setErrorMessage(translateAuthError(error));
      return;
    }
    setSubmittedEmail(values.email);
  }

  return (
    <AuthCard
      title="Recuperar senha"
      lead="Enviaremos um link para você criar uma nova senha."
      pitch={{
        headingWords: ["Recupere", "rápido,", "volte", "ao", "trabalho."],
        accentIndex: 1,
        sub: "O link chega no seu email institucional em segundos. Sem ligações, sem esperas.",
      }}
    >
      {submittedEmail ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Verifique seu email</h2>
          <p className="text-sm text-muted-foreground">
            Se houver uma conta para <strong>{submittedEmail}</strong>, você
            receberá um link em instantes. Não esqueça de conferir a pasta de
            spam.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm text-muted-foreground hover:text-primary"
          >
            ← Voltar para login
          </Link>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {errorMessage}
              </div>
            )}
            <FormField
              control={form.control}
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
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Enviando…"
                : "Enviar link de recuperação"}
            </Button>
            <Link
              href="/login"
              className="block text-center text-sm text-muted-foreground hover:text-primary"
            >
              ← Voltar para login
            </Link>
          </form>
        </Form>
      )}
    </AuthCard>
  );
}
```

- [ ] **Step 6.2: Manual smoke test**

Run: `npm run dev`, then visit `http://localhost:3000/forgot-password`.

Verify by eye:
- Split card renders with the pitch "Recupere **rápido,** volte ao trabalho." on the brand panel.
- Submitting empty shows inline "Informe um email válido." under the email field.
- Submitting `someone@example.com` (no real account) succeeds with the email-sent UI replacing the form (Supabase's `resetPasswordForEmail` does not error on unknown emails — this is by design and matches our enumeration-safe copy).
- The "Verifique seu email" success block shows the submitted email in bold and a "← Voltar para login" link.

Stop the dev server.

- [ ] **Step 6.3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6.4: Commit**

```bash
git add app/\(auth\)/forgot-password/page.tsx
git commit -m "feat(auth): rewrite /forgot-password with success-state form replacement"
```

---

## Task 7: Rewrite `/update-password`

**Files:**
- Modify: `app/(auth)/update-password/page.tsx` (full rewrite)

- [ ] **Step 7.1: Rewrite the page**

Replace the entire contents of `app/(auth)/update-password/page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  updatePasswordSchema,
  type UpdatePasswordInput,
} from "@/lib/auth-schemas";
import { translateAuthError } from "@/lib/auth-errors";

const SESSION_EXPIRED_MESSAGE = "Sua sessão expirou. Solicite um novo link.";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: UpdatePasswordInput) {
    setErrorMessage(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    if (error) {
      setErrorMessage(translateAuthError(error));
      return;
    }
    toast.success("Senha atualizada.");
    router.push("/painel");
  }

  const sessionExpired = errorMessage === SESSION_EXPIRED_MESSAGE;

  return (
    <AuthCard
      title="Nova senha"
      lead="Defina uma senha que só você conhece."
      pitch={{
        headingWords: ["Senhas", "fortes,", "dados", "protegidos."],
        accentIndex: 1,
        sub: "Mínimo de 8 caracteres. Use uma combinação que você lembre — letras, números e símbolos.",
      }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
              {sessionExpired && (
                <>
                  {" "}
                  <Link
                    href="/forgot-password"
                    className="underline underline-offset-2"
                  >
                    Solicitar novo link
                  </Link>
                </>
              )}
            </div>
          )}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova senha</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Mínimo de 8 caracteres.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar senha</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
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
            {form.formState.isSubmitting ? "Salvando…" : "Atualizar senha"}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
```

- [ ] **Step 7.2: Manual smoke test**

Run: `npm run dev`, then visit `http://localhost:3000/update-password`.

Verify by eye:
- Split card renders with the pitch "Senhas **fortes,** dados protegidos." on the brand panel.
- "Mínimo de 8 caracteres." description sits under the new-password field.
- Submitting empty shows only "A senha precisa ter ao menos 8 caracteres." under the password field (zod's object-level `.refine` runs only after field validations succeed, so the confirm-mismatch error doesn't fire when password fails length).
- Submitting password=`abcdefgh` confirm=`different` shows "As senhas não coincidem." under the confirm field only.
- Submitting matching valid passwords (e.g., password=`abcdefgh` confirm=`abcdefgh`) without a recovery session triggers the alert "Sua sessão expirou. Solicite um novo link. Solicitar novo link" (with the trailing link styled as underlined).

Stop the dev server.

- [ ] **Step 7.3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7.4: Commit**

```bash
git add app/\(auth\)/update-password/page.tsx
git commit -m "feat(auth): rewrite /update-password with confirm field + session-expired link"
```

---

## Task 8: E2E render-smoke for all three auth pages

**Files:**
- Create: `tests/e2e/auth-pages.spec.ts`

- [ ] **Step 8.1: Write the E2E spec**

Create `tests/e2e/auth-pages.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("/login renders the AuthCard with all expected affordances", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Saúde ocupacional, sem fricção." }),
  ).toBeVisible();

  const email = page.locator('input[type="email"][autocomplete="email"]');
  await expect(email).toBeVisible();

  const password = page.locator('input[type="password"][autocomplete="current-password"]');
  await expect(password).toBeVisible();

  await expect(page.getByRole("link", { name: "Esqueci a senha" })).toHaveAttribute(
    "href",
    "/forgot-password",
  );
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("/forgot-password renders the AuthCard with all expected affordances", async ({ page }) => {
  await page.goto("/forgot-password");

  await expect(page.getByRole("heading", { level: 1, name: "Recuperar senha" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Recupere rápido, volte ao trabalho." }),
  ).toBeVisible();

  await expect(page.locator('input[type="email"][autocomplete="email"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar link de recuperação" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "← Voltar para login" })).toHaveAttribute(
    "href",
    "/login",
  );
});

test("/update-password renders the AuthCard with both password fields", async ({ page }) => {
  await page.goto("/update-password");

  await expect(page.getByRole("heading", { level: 1, name: "Nova senha" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Senhas fortes, dados protegidos." }),
  ).toBeVisible();

  const passwordFields = page.locator(
    'input[type="password"][autocomplete="new-password"]',
  );
  await expect(passwordFields).toHaveCount(2);

  await expect(page.getByRole("button", { name: "Atualizar senha" })).toBeVisible();
});
```

- [ ] **Step 8.2: Run the spec**

Run: `npx playwright test tests/e2e/auth-pages.spec.ts`
Expected: PASS (3 tests). Playwright's `webServer` config auto-starts `npm run dev` on port 3000.

If a test fails because the dev server isn't ready in time, re-run the same command — `reuseExistingServer: true` keeps the running server warm.

- [ ] **Step 8.3: Commit**

```bash
git add tests/e2e/auth-pages.spec.ts
git commit -m "test(e2e): render-smoke for the three auth pages"
```

---

## Task 9: Mark Phase 3 complete in the parent spec

**Files:**
- Modify: `docs/superpowers/specs/2026-05-14-frontend-redesign-design.md`

- [ ] **Step 9.1: Capture the commit range**

Run: `git log --oneline --reverse -10`

Note the first commit of Phase 3 (the one from Task 1.5) and the last commit of Phase 3 (the one from Task 8.3). Hold those two SHAs.

- [ ] **Step 9.2: Update the Phase 3 status line**

Open `docs/superpowers/specs/2026-05-14-frontend-redesign-design.md`. Find the section:

```
### Phase 3 — Auth surface

Polished login funnel.
```

Insert a status line immediately under the heading, matching the format used for Phase 1 and Phase 2:

```
### Phase 3 — Auth surface
**Status:** ✅ Complete (commit range: <FIRST_SHA>..<LAST_SHA>)

Polished login funnel.
```

Replace `<FIRST_SHA>` and `<LAST_SHA>` with the two commit hashes captured in Step 9.1.

- [ ] **Step 9.3: Commit the spec update**

```bash
git add docs/superpowers/specs/2026-05-14-frontend-redesign-design.md
git commit -m "docs(spec): mark Phase 3 (Auth Surface) complete"
```

---

## Verification at the end

After Task 9 lands, run all checks one more time:

- `npx vitest run` — all unit tests pass (Phase 3 added schemas + errors; prior phases keep passing).
- `npx playwright test tests/e2e/auth-pages.spec.ts` — 3 tests pass.
- `npx playwright test tests/e2e/public-landing.spec.ts` — still passes (Phase 2 regression check).
- `npm run build` — passes.
- Visit `/login`, `/forgot-password`, `/update-password` in the browser at desktop width and at ~375px width: desktop shows split-card, mobile shows stacked banner above form.

The `tests/e2e/happy-path.spec.ts` is **not** part of Phase 3's verification gate — it remains gated on `E2E_OH_EMAIL` / `E2E_OH_PASSWORD` env vars as noted in the spec's "out of scope" section.
