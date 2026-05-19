# Design: Migrate afastamentos from legacy DB

**Date:** 2026-05-19  
**Scope:** One-shot migration script — `scripts/migrate-afastamentos.ts`

---

## Problem

The legacy Supabase project (different account) holds ~17k+ `afastamentos` records. The new schema is simplified: renamed fields, FK references replacing plain text, integer IDs replaced with UUIDs, and a new `serial_id` column to preserve the legacy integer ID. Records must be ported reliably without manual CSV handling.

---

## Approach

A local Node.js script using `@supabase/supabase-js` against both databases. It pre-builds lookup maps, streams legacy records in pages of 500, transforms each row, and upserts into the new DB. Idempotent — safe to re-run if interrupted.

---

## Credentials

| DB | How |
|---|---|
| New DB | `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` |
| Legacy DB | `LEGACY_URL` and `LEGACY_SERVICE_KEY` hardcoded as constants at top of script — delete after migration |

---

## Boot Phase: Lookup Maps

Built once before the migration loop starts.

| Map | Source | Key | Value |
|---|---|---|---|
| `tipoMap` | New `afastamento_tipos` | `codigo` (text) | `id` (UUID) |
| `empresaMap` | New `empresas` | `codigo_fluig` (text) | `id` (UUID) |
| `unidadeMap` | Legacy `unidades` (id→codigo) joined with new `unidades` (codigo→UUID) | legacy integer `id` | new UUID |
| `userMap` | Legacy `auth.admin.listUsers()` (email) matched against new `usuarios.email` | legacy auth UUID | new `usuarios.id` UUID |

---

## Field Mapping

| Legacy field | New field | Notes |
|---|---|---|
| `id` | `serial_id` | Preserve legacy integer ID |
| *(auto)* | `id` | New UUID, omitted so DB generates |
| `status` | `situacao` | Direct rename |
| `tipo` | `tipo_id` | Lookup via `tipoMap` |
| `empresa_id` (int) | `empresa_id` | Lookup via `empresaMap` using `String(legacy.empresa_id)` |
| `unidade_id` (int) | `unidade_id` | Lookup via `unidadeMap` |
| `responsavel` | `email_remetente` | Direct rename |
| `aprovado_por` | `decidido_por` | Lookup via `userMap`; null if not found |
| `aprovado_em` | `decidido_em` | Direct rename |
| `setor` | `colaborador_setor` | Direct rename |
| `cargo` | `colaborador_cargo` | Direct rename |
| `colaborador` | `colaborador_nome` | Direct rename |
| `cid` | `cid` | `""` → `null` |
| `hora_inicio` | `hora_inicio` | `""` → `null` |
| `hora_fim` | `hora_fim` | `""` → `null` |
| `arquivo_url` | `arquivo_url` | `""` → `null` |
| `criado_em` | `criado_em` | Preserved |
| `emissor` | `emissor` | Direct (already JSONB) |
| `inss` | `inss` | Direct |
| `acidente` | `acidente` | Direct |
| `internacao` | `internacao` | Direct |
| `data_inicio` | `data_inicio` | Direct |
| `data_fim` | `data_fim` | Direct |
| `duracao` | `duracao` | Direct |
| `ocorrencia_id` | *(skipped)* | Separate migration, out of scope |
| `medico`, `inss_docs`, `comments`, `org_id`, `criado_por`, `aprovador`, `pessoa_id` | *(dropped)* | Not in new schema |
| *(new)* | `token_edicao` | Omitted — DB default `gen_random_uuid()` |
| *(new)* | `atualizado_em` | Omitted — DB default `now()` |
| *(new)* | `motivo_rejeicao` | `null` |
| *(new)* | `enviado_fluig_em` | `null` |

---

## Migration Loop

1. Query legacy `afastamentos` ordered by `id asc`, page size 500
2. Transform each row using the maps above
3. Upsert into new `afastamentos` with `onConflict: 'serial_id'` — idempotent re-runs
4. Log `[page_offset/total] migrated X rows` per page
5. Collect and log rows that failed lookup (unknown tipo, empresa, unidade) — do not abort, skip with warning

---

## Post-Migration Step

Reset the `serial_id` sequence on the new DB so auto-incremented new records don't collide with migrated ones:

```sql
SELECT setval(
  pg_get_serial_sequence('afastamentos', 'serial_id'),
  (SELECT MAX(serial_id) FROM afastamentos)
);
```

Run this manually via Supabase SQL editor after confirming migration success.

---

## Flags

| Flag | Behavior |
|---|---|
| `--dry-run` | Builds maps, logs first 5 transformed rows, writes nothing |
| *(none)* | Full migration |

---

## Out of Scope

- `ocorrencia_id` / `afastamento_ocorrencias` links — separate feature post-delivery
- File re-hosting — legacy `arquivo_url` values point to old Supabase storage; URLs are preserved as-is
