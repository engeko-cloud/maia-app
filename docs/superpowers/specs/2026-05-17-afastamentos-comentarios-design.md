# Afastamentos — Notas Internas (Comments)

**Date:** 2026-05-17
**Scope:** App afastamento detail page, OH team only

---

## Overview

Allow OH team members to attach internal notes (text + file attachments) to any afastamento. Notes are not visible in the worker portal. Each note can carry multiple file attachments. Authors can edit and delete their own notes; admins can manage all.

---

## UI / Page Layout

The afastamento detail page (`/app/afastamentos/[id]`) has a two-column layout. The right column currently shows `<TimelineEvents>`. It becomes a vertical stack:

1. **`<ComentariosCard>`** — top
2. **`<TimelineEvents>`** — bottom

The right column wrapper changes from a single component to `flex flex-col gap-4`.

### ComentariosCard

- Header: "Notas internas" label + "Adicionar nota" button (right-aligned).
- Body: list of comments, newest first.
- Empty state: icon + "Nenhuma nota ainda."
- Each comment shows:
  - Author name + timestamp (formatted as `DD/MM/YYYY às HH:mm`)
  - "(editado)" label when `editado_em` is not null
  - Comment text
  - Attachment chips — each chip shows the filename and links to `/api/private/anexos/preview?path=...`
  - "Editar" + "Excluir" buttons (own comments only; admins see them on all comments)
- "Editar" opens the dialog pre-filled with existing text and attachments.
- "Excluir" calls DELETE immediately (no confirmation dialog — keeping it simple).

### ComentarioDialog

Used for both add and edit. Fields:
- Subtitle: "Visível apenas para a equipe OH."
- `<textarea>` — required, plain text
- File picker: "Anexar arquivo" button. Multiple files. Each selected file uploads immediately on selection to the upload endpoint and appears as a chip (filename + remove ×). Upload errors show inline next to the chip.
- "Cancelar" / "Salvar nota" buttons.

File types accepted: pdf, jpeg, png, webp. Max 10 MB per file. Same constraints as the existing attachment upload.

---

## Data Model

### New table: `afastamento_comentarios`

```sql
create table afastamento_comentarios (
  id             uuid        primary key default gen_random_uuid(),
  afastamento_id uuid        not null references afastamentos(id) on delete cascade,
  autor_id       uuid        not null references auth.users(id),
  autor_nome     text        not null,
  texto          text        not null,
  anexos         jsonb       not null default '[]',
  criado_em      timestamptz not null default now(),
  editado_em     timestamptz
);
```

`anexos` is an array of objects: `{ path: string, nome: string }`.
- `path` — Supabase Storage path: `afastamentos/comentarios/{afastamento_id}/{uuid}-{original_filename}`
- `nome` — original filename, for display

### RLS

- OH equipe members + admins: `SELECT` all comments on afastamentos they can access.
- OH equipe members: `INSERT` own rows (`autor_id = auth.uid()`). `UPDATE`/`DELETE` own rows only.
- Admins: `UPDATE`/`DELETE` all rows.

---

## Storage

Bucket: `attachments` (existing).
Path prefix: `afastamentos/comentarios/{afastamento_id}/`.

The existing `/api/private/anexos/preview` endpoint already supports the `afastamentos/` prefix — no changes needed.

---

## API Routes

All routes require the caller to be an OH equipe member or admin (same auth check pattern as `/api/afastamentos/[id]/aprovar`).

### `POST /api/afastamentos/[id]/comentarios/upload`

Accepts `multipart/form-data` with a single `file` field. Validates type and size. Uploads to `afastamentos/comentarios/{id}/{uuid}-{filename}`. Returns `{ path, nome }`.

### `POST /api/afastamentos/[id]/comentarios`

Body: `{ texto: string, anexos: { path: string, nome: string }[] }`

Zod schema:
```ts
z.object({
  texto:  z.string().min(1),
  anexos: z.array(z.object({ path: z.string(), nome: z.string() })),
})
```

Inserts row with `autor_id` and `autor_nome` from the authenticated user session. Returns `{ ok: true, id: uuid }`.

### `PATCH /api/afastamentos/[id]/comentarios/[comentarioId]`

Body: `{ texto: string, anexos: { path: string, nome: string }[] }`

Same schema as POST. Auth check: `autor_id = session.user.id` OR admin. Sets `editado_em = now()`. Returns `{ ok: true }`.

### `DELETE /api/afastamentos/[id]/comentarios/[comentarioId]`

No body. Auth check: `autor_id = session.user.id` OR admin. Returns `{ ok: true }`.

---

## Components

### `components/afastamentos/comentarios-card.tsx`

`"use client"`. Props:

```ts
interface ComentariosCardProps {
  afastamentoId: string;
  initialComentarios: Comentario[];
  currentUserId: string;
  isAdmin: boolean;
}

interface Comentario {
  id: string;
  autor_id: string;
  autor_nome: string;
  texto: string;
  anexos: { path: string; nome: string }[];
  criado_em: string;
  editado_em: string | null;
}
```

Renders the card with list + "Adicionar nota" button. Calls `router.refresh()` after successful create/edit/delete so the server re-fetches.

### `components/afastamentos/comentario-dialog.tsx`

`"use client"`. Props:

```ts
interface ComentarioDialogProps {
  afastamentoId: string;
  mode: "create" | "edit";
  comentarioId?: string;          // required when mode = "edit"
  initialTexto?: string;          // required when mode = "edit"
  initialAnexos?: { path: string; nome: string }[];  // required when mode = "edit"
  onSuccess: () => void;          // called after successful save (triggers router.refresh)
}
```

Uses the existing base-ui Dialog pattern (`DialogTrigger render={<Button />}`). Manages local state for `texto` and `anexos` (staged uploads). On file select: immediately POSTs to the upload endpoint, appends `{ path, nome }` to `anexos` state on success. On submit: POSTs/PATCHes the comment endpoint.

---

## Page Integration

`app/app/afastamentos/[id]/page.tsx`:

1. Add a 5th query to the existing `Promise.all`:
   ```ts
   supabase
     .from("afastamento_comentarios")
     .select("id, autor_id, autor_nome, texto, anexos, criado_em, editado_em")
     .eq("afastamento_id", id)
     .order("criado_em", { ascending: false })
   ```

2. Determine `isAdmin`: call `getSupabaseServer()`, fetch `auth.getUser()`, then check `profiles` or `equipe_membros` for the admin role — the same check used in `/api/afastamentos/[id]/aprovar`.

3. Right column layout:
   ```tsx
   <div className="flex flex-col gap-4">
     <ComentariosCard
       afastamentoId={row.id}
       initialComentarios={comentariosData ?? []}
       currentUserId={session.user.id}
       isAdmin={isAdmin}
     />
     <TimelineEvents ... />
   </div>
   ```

---

## Out of Scope

- Portal visibility (comments are OH-internal only)
- @mentions or rich text (plain text only)
- Comment threading / replies
- Notifications when a comment is added
- Deleting orphaned storage files when a comment is deleted (files persist in storage — acceptable for now)
