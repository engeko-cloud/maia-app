# maia-app

Frontend Next.js da MAIA — sistema single-tenant de saúde ocupacional da ENGEKO.

Especificação canônica: [`../old-maia/BUILD-SPEC.md`](../old-maia/BUILD-SPEC.md).

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencher os valores
npm run dev
```

Stack: Next.js 16 (App Router), React 19, TypeScript estrito, Tailwind 4, shadcn/ui, `@supabase/ssr`, Resend.
