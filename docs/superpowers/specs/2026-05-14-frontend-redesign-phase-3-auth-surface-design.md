# Phase 3 — Auth Surface (Design)

**Parent spec:** [`2026-05-14-frontend-redesign-design.md`](./2026-05-14-frontend-redesign-design.md) — sections 3 (shell layout), 6 (auth shell + pages), 12 (phase plan).

**Status:** Spec — implementation pending.

**Date:** 2026-05-14.

## 1. Goal

Replace the unstyled `<input>`-based auth pages with a branded split-card auth funnel under a new `(auth)` shell. Three pages get rewritten — `/login`, `/forgot-password`, `/update-password` — using react-hook-form + zod, with inline validation errors, translated Supabase messages, and the parent spec's "auth-pages-v2" visual treatment (gradient brand panel + orange radial glow + accent underline + accent edge-line on buttons).

## 2. Scope

**In scope:**

- `app/(auth)/layout.tsx` — centered viewport, soft gradient backdrop, no nav.
- `components/auth/auth-card.tsx` — split-card shell, server component, props-driven.
- Rewrite `app/(auth)/login/page.tsx`, `forgot-password/page.tsx`, `update-password/page.tsx` to use RHF + zod + `<AuthCard>`.
- `lib/auth-schemas.ts` — three zod schemas (login, forgot, update).
- `lib/auth-errors.ts` — Supabase error message → Portuguese translation.
- Unit tests: `tests/unit/auth-schemas.test.ts` + `tests/unit/auth-errors.test.ts`.
- E2E render-smoke: `tests/e2e/auth-pages.spec.ts`.

**Out of scope (preserved verbatim, not touched):**

- `app/auth/callback/route.ts` and `app/auth/confirm/route.ts` — handle PKCE code exchange and OTP verification correctly.
- `middleware.ts`, `lib/supabase/*` — unchanged.
- Supabase email templates (managed in the Supabase Dashboard per commit `5c1b4d4`).
- The `redirectTo` URL in forgot-password — current direct redirect to `/update-password` matches Dashboard-side template wiring.
- `tests/e2e/happy-path.spec.ts` — its `E2E_OH_EMAIL` / `E2E_OH_PASSWORD` env-var gap is pre-existing.

**Explicit non-goals:**

- Google OAuth.
- Signup link / self-registration.
- Password-strength meter.
- MFA / 2FA.
- Dark mode (deferred per parent spec section 13).

## 3. Approach

**Monolithic `<AuthCard>` with typed props.** One server component owns the split-card layout (desktop) and stacked banner (mobile). Pages pass a `pitch` object (heading words + accent index + sub-copy) so the accent-orange word can land anywhere in the heading without nested children.

**Schemas live in `lib/auth-schemas.ts`** as pure zod modules; pages import the schema and its inferred type. **Error translation lives in `lib/auth-errors.ts`** as a single pure function. Both are unit-testable in isolation.

**Form pattern:** RHF (via the `<Form>` wrapper in `components/ui/form.tsx`) + zod resolver + `<FormMessage>` for inline field errors + a sibling alert above the form for Supabase-returned errors. This sets the operational form pattern Phase 5 will reuse on list/detail/admin forms.

**Inline error alert, not toast,** for submit failures. Toasts are reserved for one-shot confirmations where the user is leaving the page (e.g., `/update-password` success → `/painel`).

## 4. File structure

```
app/
└── (auth)/
    ├── layout.tsx              NEW — centered + gradient backdrop
    ├── login/page.tsx          REWRITE — RHF + zod + <AuthCard>
    ├── forgot-password/page.tsx REWRITE — same
    └── update-password/page.tsx REWRITE — same

components/
└── auth/
    └── auth-card.tsx           NEW — split-card shell (server component)

lib/
├── auth-schemas.ts             NEW — zod schemas for the 3 forms
└── auth-errors.ts              NEW — Supabase error → PT message

tests/
├── unit/
│   ├── auth-schemas.test.ts    NEW
│   └── auth-errors.test.ts     NEW
└── e2e/
    └── auth-pages.spec.ts      NEW — render-smoke for all 3 pages
```

- `<AuthCard>` is a server component (pitch and brand stamp are pure markup).
- Each page form (e.g., `LoginForm`) is colocated inside the page file rather than extracted — each form is page-specific and short. Splitting would spread state across files for no gain.
- Pages are client components ("use client") because RHF owns local state.

## 5. AuthCard component

### Props

```ts
interface AuthCardPitch {
  /** Heading words. The word at `accentIndex` renders in --color-accent. */
  headingWords: string[];
  /** Zero-based index into `headingWords` for the accent-colored word. */
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
```

### Desktop layout (`md` and up)

- Outer wrapper: `max-w-[720px]`, `w-full`, `rounded-[var(--radius-xl)]`, `shadow-[var(--shadow-lg)]`, `border border-[var(--color-border)]`, `overflow-hidden`, `bg-white`.
- Grid: `grid grid-cols-1 md:grid-cols-[1.05fr_1fr]`. Form panel left, brand panel right.
- **Form panel** (`md:p-8 p-6`):
  - Top: `<Link href="/" className="inline-flex items-center gap-2">` wrapping `<LogoMark size="sm" />` (the existing gradient mark already provides the orange→blue "M" badge called for in parent-spec section 6 — no extra badge added) + wordmark "MAIA · ENGEKO" (`text-sm font-semibold tracking-tight`, with the `·` rendered in `text-[var(--brand-accent-500)]` for the accent-dot detail).
  - Title: `text-2xl font-semibold tracking-tight mt-6`.
  - Lead: `text-sm text-muted-foreground mt-1`.
  - `{children}` (the form), with `mt-6`.
- **Brand panel** (`md:p-8 p-6 relative bg-gradient-to-br from-[var(--brand-primary-600)] to-[var(--brand-primary-900)] text-white`):
  - `::before` (a pseudo-element via a `before:` Tailwind class chain) creates the orange radial glow: `before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,var(--brand-accent-500)/30,transparent_60%)] before:pointer-events-none`.
  - Pitch heading: `text-xl font-semibold leading-tight`, words rendered with `headingWords.map((w, i) => <span key={i} className={i === accentIndex ? "text-[var(--brand-accent-500)]" : ""}>{w}</span>)` separated by spaces.
  - Accent underline: `<div className="mt-3 h-[3px] w-12 bg-[var(--brand-accent-500)] rounded-full" />`.
  - Sub-copy: `text-sm text-white/80 mt-4`.
  - Footer line at the bottom (`mt-auto pt-8`): `v{APP_VERSION}` + accent-dot separator (`·` in `text-[var(--brand-accent-500)]`) + `© 2026 ENGEKO`, all in `text-xs text-white/60`.

### Mobile layout (below `md`)

Grid collapses to `grid-cols-1`. Brand panel renders **first** (stacks above the form) as a compact top banner:

- `flex items-center gap-3 p-5` with the same gradient + radial glow background.
- Contains only the brand stamp: `<Link href="/" className="inline-flex items-center gap-2">` wrapping `<LogoMark size="sm" />` + wordmark "MAIA · ENGEKO" in `text-sm font-semibold text-white` (with the `·` in `text-[var(--brand-accent-500)]`).
- **No** pitch heading, **no** sub-copy, **no** version line. Those are desktop-only — the small viewport itself signals "this is the MAIA auth screen" without needing the marketing surface.

Form panel below uses `p-6` and contains the same content (logo stamp, title, lead, form).

### Submit-button accent edge

Primary `<Button>` submits on auth pages wear a 3px bottom border in `var(--brand-accent-500)`. Applied via a className extension at the page level (not built into `<AuthCard>`):

```tsx
<Button
  type="submit"
  className="w-full border-b-[3px] border-[var(--brand-accent-500)]"
>
  Entrar
</Button>
```

This is intentional repetition (three pages × one button) rather than a wrapper component — three call sites is below the "build an abstraction" threshold.

## 6. Schemas

`lib/auth-schemas.ts`:

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

**Decisions baked in:**

- Login uses `min(1)` on password — no minimum-length check at sign-in. A user with a legacy 6-char password must still be able to log in.
- `trim().toLowerCase()` on email avoids whitespace/case mismatches against the stored email.
- Update-password's `refine` attaches the cross-field error to `path: ["confirm"]`, so RHF renders the message under the confirm input (where the user's eye is).
- Update-password's min-length is **8** (matches what ships today and the Supabase default; non-disruptive).

## 7. Error translation

`lib/auth-errors.ts`:

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

**Decisions:**

- Returns `null` for null/undefined input so callers can `if (msg)` to decide whether to show the alert.
- Unknown messages fall through to a generic Portuguese line — Supabase's English strings never reach users.
- The mapped strings are stable Supabase error messages (matching the auth API). If Supabase changes them, the test suite catches it the next time the strings stop matching.

## 8. Per-page specifications

### `/login`

**Form column:**

- Title: `Entrar`
- Lead: `Acesse sua conta para gerenciar afastamentos e ocorrências.`
- Fields:
  - `email` — `<Input type="email" autoComplete="email" />`
  - `password` — `<Input type="password" autoComplete="current-password" />`
- Right-aligned `<Link href="/forgot-password">` "Esqueci a senha" sitting just below the password field row (`text-sm text-muted-foreground hover:text-primary`).
- Submit: `<Button>` "Entrar" (loading state text: "Entrando…", disabled when `formState.isSubmitting`).
- Inline error alert above the form when present: `<div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{message}</div>`.
- On success: `router.push("/painel"); router.refresh();`
- On error: call `translateAuthError(error)` and set local `errorMessage` state, render the alert.
- **No** Google OAuth, **no** signup link.

**Brand pitch:**

- `headingWords`: `["Saúde", "ocupacional,", "sem", "fricção."]`
- `accentIndex`: `1`
- `sub`: `Aprovações, investigações e relatórios em um único painel — feito para a equipe de SST da ENGEKO.`

### `/forgot-password`

**Form column:**

- Title: `Recuperar senha`
- Lead: `Enviaremos um link para você criar uma nova senha.`
- Fields: `email` (same input pattern as login).
- Submit: "Enviar link de recuperação" (loading: "Enviando…").
- "← Voltar para login" `<Link href="/login">` below the submit button (`text-sm text-muted-foreground`).
- **Success state — replace the form**, do not toast:
  - Heading: `Verifique seu email`
  - Body: `Se houver uma conta para {email}, você receberá um link em instantes. Não esqueça de conferir a pasta de spam.`
  - "← Voltar para login" link.
  - Replacing (rather than leaving the form sitting there) prevents accidental resubmissions and reads as completion. The phrasing intentionally avoids confirming whether the email exists — sidesteps account enumeration.
- On error: inline alert (same component as login).
- Preserves current redirect: `redirectTo: ${process.env.NEXT_PUBLIC_APP_BASE_URL ?? window.location.origin}/update-password`.

**Brand pitch:**

- `headingWords`: `["Recupere", "rápido,", "volte", "ao", "trabalho."]`
- `accentIndex`: `1`
- `sub`: `O link chega no seu email institucional em segundos. Sem ligações, sem esperas.`

### `/update-password`

**Form column:**

- Title: `Nova senha`
- Lead: `Defina uma senha que só você conhece.`
- Fields:
  - `password` — `<Input type="password" autoComplete="new-password" />`. `<FormDescription>` below: `Mínimo de 8 caracteres.`
  - `confirm` — `<Input type="password" autoComplete="new-password" />` with label "Confirmar senha".
- Submit: "Atualizar senha" (loading: "Salvando…").
- On success: `toast.success("Senha atualizada.")` + `router.push("/painel")`. Toast is appropriate because the user is leaving the page — an inline alert would never be read.
- On error: inline alert. **Special case:** when `translateAuthError` returns "Sua sessão expirou. Solicite um novo link." (mapped from `Auth session missing!`), the alert body includes a `<Link href="/forgot-password">` "Solicitar novo link" so the user has a one-click recovery path.
- **No** "← Voltar" link — the user is mid-recovery; back-to-login is a dead end.

**Brand pitch:**

- `headingWords`: `["Senhas", "fortes,", "dados", "protegidos."]`
- `accentIndex`: `1`
- `sub`: `Mínimo de 8 caracteres. Use uma combinação que você lembre — letras, números e símbolos.`

## 9. Auth shell layout

`app/(auth)/layout.tsx` — server component, no nav:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-[var(--color-bg-subtle)] to-[var(--brand-primary-50)]">
      {children}
    </div>
  );
}
```

- Centers the AuthCard horizontally and vertically.
- Soft gradient backdrop using existing tokens (no new tokens introduced).
- Padding scales with viewport (`p-4` on phone for tighter framing, `p-6` on tablet+).

## 10. Tests

### Unit (vitest)

**`tests/unit/auth-schemas.test.ts`** — covers:

- `loginSchema`: valid pair passes; empty email fails with "Informe um email válido."; empty password fails with "Informe sua senha."; malformed email fails; email is trimmed + lowercased after parse.
- `forgotPasswordSchema`: valid email passes; malformed email fails.
- `updatePasswordSchema`: matching valid passwords pass; password shorter than 8 chars fails on `password` path; mismatched confirm fails on `confirm` path with "As senhas não coincidem."

**`tests/unit/auth-errors.test.ts`** — covers:

- Each of the 6 mapped Supabase strings returns the expected PT message.
- Unknown message returns "Não foi possível concluir. Tente novamente."
- `null` input returns `null`.
- `undefined` input returns `null`.

### E2E (Playwright) — `tests/e2e/auth-pages.spec.ts`

Render-smoke only, no submits, no env-vars. Three test cases:

1. **`/login` renders correctly:**
   - Visits `/login`.
   - Asserts `<h1>` with name "Entrar" is visible.
   - Asserts `input[type=email][autocomplete=email]` and `input[type=password][autocomplete=current-password]` are present.
   - Asserts `<a href="/forgot-password">` "Esqueci a senha" is visible.
   - Asserts submit button "Entrar" is visible.
   - Asserts the brand-panel pitch heading is visible (text match: `Saúde ocupacional, sem fricção.`) — guards against the responsive split collapsing in CI's desktop viewport.

2. **`/forgot-password` renders correctly:**
   - Visits `/forgot-password`.
   - Asserts `<h1>` "Recuperar senha", email field, submit "Enviar link de recuperação", "← Voltar para login" link to `/login`.
   - Asserts pitch heading: `Recupere rápido, volte ao trabalho.`

3. **`/update-password` renders correctly:**
   - Visits `/update-password`.
   - Asserts `<h1>` "Nova senha", two `input[type=password][autocomplete=new-password]` fields (different `name` attrs: `password` and `confirm`), submit "Atualizar senha".
   - Asserts pitch heading: `Senhas fortes, dados protegidos.`

### What we deliberately don't test

- Actual login flow → `happy-path.spec.ts` (env-var gated, not Phase 3's responsibility).
- Forgot-password email round-trip → no email-interception infrastructure.
- Update-password with a recovery token → no session-injection infrastructure.
- Toast appearance → flaky in Playwright; the success message we *do* assert is forgot-password's form-replacement (a real DOM change).

## 11. Build order

Each step ends green and committable.

1. **Schemas + error map** — `lib/auth-schemas.ts` + `lib/auth-errors.ts` with their unit tests. Pure modules, no UI deps. Lands the type contract first.
2. **AuthCard component** — `components/auth/auth-card.tsx` with desktop split + mobile stacked banner.
3. **Auth layout** — `app/(auth)/layout.tsx`.
4. **Login rewrite** — `app/(auth)/login/page.tsx`.
5. **Forgot-password rewrite** — `app/(auth)/forgot-password/page.tsx` with success-state form replacement.
6. **Update-password rewrite** — `app/(auth)/update-password/page.tsx` with confirm field + session-expired handling.
7. **E2E render-smoke** — `tests/e2e/auth-pages.spec.ts`.
8. **Parent spec update** — mark Phase 3 ✅ Complete with the commit range.

**Verification per step:** `npm run build` passes, `npx vitest run` passes, and the Playwright spec passes on step 7+.

## 12. Dependencies on prior phases

All satisfied:

- Tokens (`app/tokens.css`) — Phase 1 ✅
- shadcn `Form` / `Input` / `Field` / `Button` / `Label` primitives — Phase 1 ✅
- `<LogoMark>` — Phase 1 ✅
- `APP_VERSION` from `lib/version.ts` + script-side version injection — Phase 1 + Phase 2 ✅
- `getSupabaseBrowser()` from `lib/supabase/client.ts` — preexisting ✅

No dependencies on Phase 4 or later.

## 13. Success criteria

A Phase 3 review passes when:

1. Visiting `/login`, `/forgot-password`, `/update-password` shows the branded split-card on desktop and the stacked-banner variant on phone.
2. Empty submits surface inline field errors in Portuguese (zod messages) under each field — not via toast.
3. A failed login surfaces "Email ou senha incorretos." in the inline alert above the form, not a toast.
4. A successful login redirects to `/painel`.
5. Forgot-password submit replaces the form with the "Verifique seu email" success block.
6. Update-password with mismatched confirm shows "As senhas não coincidem." under the confirm field.
7. All `npx vitest run` cases pass (schemas + error map).
8. `tests/e2e/auth-pages.spec.ts` passes.
9. `npm run build` passes.
10. Parent spec section 12 is updated with the Phase 3 commit range.
