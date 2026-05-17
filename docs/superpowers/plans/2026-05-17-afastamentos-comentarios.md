# Afastamentos — Notas Internas (Comments) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an OH-internal comments system (text + multi-file attachments) to the afastamento detail page, displayed in a new "Notas internas" card above the existing timeline.

**Architecture:** New `afastamento_comentarios` Supabase table stores comments; files upload to the existing `attachments` bucket under `afastamentos/comentarios/` prefix and are previewed via the existing private preview endpoint. Two new client components (`ComentarioDialog`, `ComentariosCard`) plug into the detail page server component, which fetches initial data server-side and passes it as props.

**Tech Stack:** Next.js 15 App Router, Supabase (postgres + storage), Zod, base-ui Dialog, sonner toasts, date-fns, TypeScript.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Run SQL | Supabase dashboard | Create `afastamento_comentarios` table + RLS |
| Create | `app/api/afastamentos/[id]/comentarios/upload/route.ts` | Auth-gated file upload → storage |
| Create | `app/api/afastamentos/[id]/comentarios/route.ts` | POST — create comment |
| Create | `app/api/afastamentos/[id]/comentarios/[comentarioId]/route.ts` | PATCH/DELETE — edit/delete comment |
| Create | `components/afastamentos/comentario-dialog.tsx` | Dialog for create + edit, file upload UI |
| Create | `components/afastamentos/comentarios-card.tsx` | Card: list + empty state + action buttons |
| Modify | `app/app/afastamentos/[id]/page.tsx` | 5th query + isAdmin + right column layout |

---

## Task 1: Database — `afastamento_comentarios` table

**Files:**
- Run SQL in: Supabase Dashboard → SQL Editor

- [ ] **Step 1: Run the migration SQL**

Open Supabase Dashboard → SQL Editor and run:

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

alter table afastamento_comentarios enable row level security;

-- Authenticated users (OH team — gated at app level) can read all comments
create policy "autenticados podem ler comentarios"
  on afastamento_comentarios for select
  to authenticated
  using (true);
```

- [ ] **Step 2: Verify the table exists**

In Supabase Dashboard → Table Editor, confirm `afastamento_comentarios` appears with the correct columns.

- [ ] **Step 3: No commit needed**

This task has no code files — the SQL runs directly in the dashboard. Move on to Task 2.

---

## Task 2: File upload endpoint

**Files:**
- Create: `app/api/afastamentos/[id]/comentarios/upload/route.ts`

The existing public upload at `app/api/public/afastamentos/upload/route.ts` is the pattern. This new endpoint is auth-gated (OH equipe or admin) and stores files under a different prefix.

- [ ] **Step 1: Create the upload route**

```typescript
// app/api/afastamentos/[id]/comentarios/upload/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("administrador")
    .eq("id", user.id)
    .single();
  const { data: m } = await supabase
    .from("equipe_usuarios")
    .select("equipes!inner(codigo)")
    .eq("usuario_id", user.id);
  const isOh = (m ?? []).some((r: any) => r.equipes?.codigo === "oh");
  if (!usuario?.administrador && !isOh) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "bad_mime" }, { status: 415 });

  const admin = getSupabaseAdmin();
  const path = `afastamentos/comentarios/${id}/${crypto.randomUUID()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from("attachments").upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ path, nome: file.name });
}
```

- [ ] **Step 2: Smoke-test manually**

Start dev server (`npm run dev`). Open the afastamento detail page for any pending record. In browser devtools Console, run:

```javascript
const form = new FormData();
// Use a real small file from your desktop — drag into devtools won't work,
// so just verify the route returns 401 when not logged in by fetching directly:
fetch('/api/afastamentos/some-id/comentarios/upload', { method: 'POST', body: new FormData() })
  .then(r => r.json()).then(console.log);
// Expected: { error: "no_file" } (not 401 because you ARE logged in as OH)
// or { error: "unauthorized" } if session expired
```

The endpoint doesn't need a full integration test — it's covered by the dialog in Task 5.

- [ ] **Step 3: Commit**

```bash
git add app/api/afastamentos/[id]/comentarios/upload/route.ts
git commit -m "feat(afastamentos): add OH-gated comment file upload endpoint"
```

---

## Task 3: Comment create endpoint

**Files:**
- Create: `app/api/afastamentos/[id]/comentarios/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/afastamentos/[id]/comentarios/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const CreateSchema = z.object({
  texto:  z.string().min(1),
  anexos: z.array(z.object({ path: z.string(), nome: z.string() })),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: usuario }, { data: m }] = await Promise.all([
    supabase.from("usuarios").select("nome, administrador").eq("id", user.id).single(),
    supabase.from("equipe_usuarios").select("equipes!inner(codigo)").eq("usuario_id", user.id),
  ]);
  const isOh = (m ?? []).some((r: any) => r.equipes?.codigo === "oh");
  if (!usuario?.administrador && !isOh) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("afastamento_comentarios")
    .insert({
      afastamento_id: id,
      autor_id:       user.id,
      autor_nome:     usuario?.nome ?? "Usuário",
      texto:          parsed.data.texto,
      anexos:         parsed.data.anexos,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/afastamentos/[id]/comentarios/route.ts
git commit -m "feat(afastamentos): add comment create endpoint"
```

---

## Task 4: Comment edit + delete endpoints

**Files:**
- Create: `app/api/afastamentos/[id]/comentarios/[comentarioId]/route.ts`

Auth rule for both: `autor_id === user.id` OR `usuario.administrador === true`.

- [ ] **Step 1: Create the route**

```typescript
// app/api/afastamentos/[id]/comentarios/[comentarioId]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const EditSchema = z.object({
  texto:  z.string().min(1),
  anexos: z.array(z.object({ path: z.string(), nome: z.string() })),
});

async function resolveAuth(supabase: Awaited<ReturnType<typeof getSupabaseServer>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("administrador")
    .eq("id", user.id)
    .single();
  return { user, isAdmin: usuario?.administrador === true };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; comentarioId: string }> },
) {
  const { id, comentarioId } = await params;
  const supabase = await getSupabaseServer();
  const auth = await resolveAuth(supabase);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = EditSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Fetch to verify ownership
  const { data: comentario } = await admin
    .from("afastamento_comentarios")
    .select("autor_id")
    .eq("id", comentarioId)
    .eq("afastamento_id", id)
    .single();

  if (!comentario) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!auth.isAdmin && comentario.autor_id !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("afastamento_comentarios")
    .update({
      texto:      parsed.data.texto,
      anexos:     parsed.data.anexos,
      editado_em: new Date().toISOString(),
    } as any)
    .eq("id", comentarioId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; comentarioId: string }> },
) {
  const { id, comentarioId } = await params;
  const supabase = await getSupabaseServer();
  const auth = await resolveAuth(supabase);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();

  const { data: comentario } = await admin
    .from("afastamento_comentarios")
    .select("autor_id")
    .eq("id", comentarioId)
    .eq("afastamento_id", id)
    .single();

  if (!comentario) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!auth.isAdmin && comentario.autor_id !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("afastamento_comentarios")
    .delete()
    .eq("id", comentarioId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/afastamentos/[id]/comentarios/[comentarioId]/route.ts
git commit -m "feat(afastamentos): add comment edit and delete endpoints"
```

---

## Task 5: `ComentarioDialog` component

**Files:**
- Create: `components/afastamentos/comentario-dialog.tsx`

This dialog handles both create and edit modes. Files upload immediately on selection; the submit sends already-uploaded paths. The `trigger` prop is passed to `DialogTrigger render={...}`.

- [ ] **Step 1: Create the component**

```typescript
// components/afastamentos/comentario-dialog.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PaperclipIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type AnexoEntry = {
  tempId: string;
  path: string;
  nome: string;
  uploading: boolean;
  error?: string;
};

interface ComentarioDialogProps {
  afastamentoId: string;
  mode: "create" | "edit";
  comentarioId?: string;
  initialTexto?: string;
  initialAnexos?: { path: string; nome: string }[];
  onSuccess: () => void;
  trigger: React.ReactElement;
}

export function ComentarioDialog({
  afastamentoId,
  mode,
  comentarioId,
  initialTexto,
  initialAnexos,
  onSuccess,
  trigger,
}: ComentarioDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [texto, setTexto] = React.useState("");
  const [anexos, setAnexos] = React.useState<AnexoEntry[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (!open) return;
    setTexto(initialTexto ?? "");
    setAnexos(
      (initialAnexos ?? []).map((a) => ({
        tempId: crypto.randomUUID(),
        path: a.path,
        nome: a.nome,
        uploading: false,
      })),
    );
    setBusy(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFiles(files: FileList) {
    for (const file of Array.from(files)) {
      const tempId = crypto.randomUUID();
      setAnexos((prev) => [
        ...prev,
        { tempId, path: "", nome: file.name, uploading: true },
      ]);
      const form = new FormData();
      form.append("file", file);
      try {
        const r = await fetch(
          `/api/afastamentos/${afastamentoId}/comentarios/upload`,
          { method: "POST", body: form },
        );
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          const msg =
            r.status === 413
              ? "Arquivo muito grande (máx 10 MB)."
              : r.status === 415
                ? "Tipo não permitido (PDF, JPG, PNG, WEBP)."
                : (j.error ?? "Erro no upload.");
          setAnexos((prev) =>
            prev.map((a) =>
              a.tempId === tempId ? { ...a, uploading: false, error: msg } : a,
            ),
          );
        } else {
          const { path, nome } = await r.json();
          setAnexos((prev) =>
            prev.map((a) =>
              a.tempId === tempId ? { ...a, path, nome, uploading: false } : a,
            ),
          );
        }
      } catch {
        setAnexos((prev) =>
          prev.map((a) =>
            a.tempId === tempId
              ? { ...a, uploading: false, error: "Erro no upload." }
              : a,
          ),
        );
      }
    }
  }

  function removeAnexo(tempId: string) {
    setAnexos((prev) => prev.filter((a) => a.tempId !== tempId));
  }

  async function salvar() {
    if (!texto.trim()) {
      toast.error("A nota não pode estar vazia.");
      return;
    }
    if (anexos.some((a) => a.uploading)) {
      toast.error("Aguarde o upload dos arquivos.");
      return;
    }

    const body = {
      texto: texto.trim(),
      anexos: anexos
        .filter((a) => !a.error && a.path)
        .map((a) => ({ path: a.path, nome: a.nome })),
    };

    setBusy(true);

    const url =
      mode === "create"
        ? `/api/afastamentos/${afastamentoId}/comentarios`
        : `/api/afastamentos/${afastamentoId}/comentarios/${comentarioId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setBusy(false);

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao salvar nota.");
      return;
    }

    toast.success(mode === "create" ? "Nota adicionada." : "Nota atualizada.");
    setOpen(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Adicionar nota" : "Editar nota"}
          </DialogTitle>
          <DialogDescription>Visível apenas para a equipe OH.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="comentario-texto">Nota</Label>
            <Textarea
              id="comentario-texto"
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Observação, contato telefônico, próximo passo…"
            />
          </div>

          {/* Attachment chips */}
          {anexos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {anexos.map((a) => (
                <span
                  key={a.tempId}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                    a.error
                      ? "border-[var(--color-danger)] text-[var(--color-danger)]"
                      : a.uploading
                        ? "border-[var(--color-border)] text-[var(--color-fg-muted)]"
                        : "border-[var(--color-border)] text-[var(--color-fg)]",
                  ].join(" ")}
                >
                  {a.uploading ? "⏳" : a.error ? "⚠" : "📎"}
                  <span className="max-w-[160px] truncate">
                    {a.error ?? a.nome}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAnexo(a.tempId)}
                    className="ml-0.5 opacity-60 hover:opacity-100"
                    aria-label={`Remover ${a.nome}`}
                  >
                    <XIcon className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <PaperclipIcon className="size-4" aria-hidden="true" />
              Anexar arquivo
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={busy}>
            Salvar nota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep comentario-dialog
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add components/afastamentos/comentario-dialog.tsx
git commit -m "feat(afastamentos): add ComentarioDialog component"
```

---

## Task 6: `ComentariosCard` component

**Files:**
- Create: `components/afastamentos/comentarios-card.tsx`

Receives the comment list from the server as props. After any mutation, calls `router.refresh()` so the server re-fetches and updates props. Does NOT store the list in local state — relies on the Next.js re-render cycle.

- [ ] **Step 1: Create the component**

```typescript
// components/afastamentos/comentarios-card.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { AttachmentChip } from "@/components/detail/attachment-chip";
import { ComentarioDialog } from "./comentario-dialog";

export interface Comentario {
  id: string;
  autor_id: string;
  autor_nome: string;
  texto: string;
  anexos: { path: string; nome: string }[];
  criado_em: string;
  editado_em: string | null;
}

interface ComentariosCardProps {
  afastamentoId: string;
  comentarios: Comentario[];
  currentUserId: string;
  isAdmin: boolean;
}

function fmtDateTime(iso: string) {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function ComentariosCard({
  afastamentoId,
  comentarios,
  currentUserId,
  isAdmin,
}: ComentariosCardProps) {
  const router = useRouter();

  async function handleDelete(comentarioId: string) {
    const r = await fetch(
      `/api/afastamentos/${afastamentoId}/comentarios/${comentarioId}`,
      { method: "DELETE" },
    );
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao excluir nota.");
      return;
    }
    toast.success("Nota excluída.");
    router.refresh();
  }

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Notas internas
        </h2>
        <ComentarioDialog
          afastamentoId={afastamentoId}
          mode="create"
          onSuccess={() => router.refresh()}
          trigger={
            <Button variant="outline" size="sm">
              <PlusIcon className="size-4" aria-hidden="true" />
              Adicionar nota
            </Button>
          }
        />
      </div>

      {/* Body */}
      {comentarios.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
          <span className="text-2xl" aria-hidden="true">📝</span>
          <p className="text-sm text-[var(--color-fg-muted)]">Nenhuma nota ainda.</p>
        </div>
      ) : (
        <ol>
          {comentarios.map((c, idx) => {
            const canEdit = isAdmin || c.autor_id === currentUserId;
            return (
              <li
                key={c.id}
                className={[
                  "flex flex-col gap-1.5 px-4 py-3",
                  idx < comentarios.length - 1
                    ? "border-b border-[var(--color-border)]"
                    : "",
                ].join(" ")}
              >
                {/* Meta row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      {c.autor_id === currentUserId ? "Você" : c.autor_nome}
                    </span>
                    <time
                      dateTime={c.criado_em}
                      className="text-xs text-[var(--color-fg-muted)]"
                    >
                      {fmtDateTime(c.criado_em)}
                    </time>
                    {c.editado_em && (
                      <span className="text-xs italic text-[var(--color-fg-subtle)]">
                        (editado)
                      </span>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-2">
                      <ComentarioDialog
                        afastamentoId={afastamentoId}
                        mode="edit"
                        comentarioId={c.id}
                        initialTexto={c.texto}
                        initialAnexos={c.anexos}
                        onSuccess={() => router.refresh()}
                        trigger={
                          <button
                            type="button"
                            className="text-xs text-[var(--color-fg-muted)] hover:text-foreground"
                            aria-label="Editar nota"
                          >
                            <PencilIcon className="size-3.5" />
                          </button>
                        }
                      />
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="text-xs text-[var(--color-danger)] hover:opacity-70"
                        aria-label="Excluir nota"
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Text */}
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {c.texto}
                </p>

                {/* Attachments */}
                {c.anexos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {c.anexos.map((a) => (
                      <AttachmentChip
                        key={a.path}
                        href={`/api/private/anexos/preview?path=${encodeURIComponent(a.path)}`}
                        filename={a.nome}
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "comentarios-card\|comentario-dialog"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/afastamentos/comentarios-card.tsx
git commit -m "feat(afastamentos): add ComentariosCard component"
```

---

## Task 7: Page integration

**Files:**
- Modify: `app/app/afastamentos/[id]/page.tsx`

Changes:
1. Add `getIsAdmin` helper function (alongside existing `userCanApprove`).
2. Add 5th query to the `Promise.all` — fetch comments.
3. Run `canApprove` and `isAdmin` in parallel (not waterfall).
4. Restructure the right column: `<ComentariosCard>` on top, `<TimelineEvents>` below.

- [ ] **Step 1: Read `app/app/afastamentos/[id]/page.tsx` in full**

Use the Read tool on `app/app/afastamentos/[id]/page.tsx` before making any edits. You need the exact line numbers and current imports to apply Steps 2–6 correctly.

- [ ] **Step 2: Add imports**

Add these two imports at the top of the file alongside the existing imports:

```typescript
import { ComentariosCard, type Comentario } from "@/components/afastamentos/comentarios-card";
```

- [ ] **Step 3: Add `getIsAdmin` helper**

Add this function immediately after the existing `userCanApprove` function (around line 24):

```typescript
async function getIsAdmin(userId: string): Promise<boolean> {
  const supabase = await getSupabaseServer();
  const { data: u } = await supabase
    .from("usuarios")
    .select("administrador")
    .eq("id", userId)
    .single();
  return u?.administrador === true;
}
```

- [ ] **Step 4: Expand `Promise.all` to 5 queries**

Replace the existing 4-query `Promise.all`:

```typescript
const [
  { data: rawRow },
  { data: timelineData },
  { data: tiposData },
  { data: unidadesData },
] = await Promise.all([
  supabase
    .from("afastamentos")
    .select("*, empresas!inner(nome), unidades!inner(nome), afastamento_tipos!inner(rotulo)")
    .eq("id", id)
    .single(),
  supabase
    .from("eventos")
    .select("id, evento, ocorrido_em, usuarios:autor_id(nome)")
    .eq("tipo_entidade", "afastamento")
    .eq("entidade_id", id)
    .order("ocorrido_em", { ascending: false })
    .returns<TimelineEventRow[]>(),
  supabase
    .from("afastamento_tipos")
    .select("id, rotulo")
    .eq("requer_aprovacao", true)
    .order("ordem"),
  supabase
    .from("unidades")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome"),
]);
```

With this 5-query version:

```typescript
const [
  { data: rawRow },
  { data: timelineData },
  { data: tiposData },
  { data: unidadesData },
  { data: comentariosData },
] = await Promise.all([
  supabase
    .from("afastamentos")
    .select("*, empresas!inner(nome), unidades!inner(nome), afastamento_tipos!inner(rotulo)")
    .eq("id", id)
    .single(),
  supabase
    .from("eventos")
    .select("id, evento, ocorrido_em, usuarios:autor_id(nome)")
    .eq("tipo_entidade", "afastamento")
    .eq("entidade_id", id)
    .order("ocorrido_em", { ascending: false })
    .returns<TimelineEventRow[]>(),
  supabase
    .from("afastamento_tipos")
    .select("id, rotulo")
    .eq("requer_aprovacao", true)
    .order("ordem"),
  supabase
    .from("unidades")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome"),
  supabase
    .from("afastamento_comentarios")
    .select("id, autor_id, autor_nome, texto, anexos, criado_em, editado_em")
    .eq("afastamento_id", id)
    .order("criado_em", { ascending: false })
    .returns<Comentario[]>(),
]);
```

- [ ] **Step 5: Replace the waterfall auth check with parallel execution**

Replace:

```typescript
const canApprove = user ? await userCanApprove(user.id) : false;
```

With:

```typescript
const [canApprove, isAdmin] = await Promise.all([
  user ? userCanApprove(user.id) : Promise.resolve(false),
  user ? getIsAdmin(user.id) : Promise.resolve(false),
]);
```

- [ ] **Step 6: Restructure the right column JSX**

Find the `<aside>` block in the return statement:

```tsx
<aside className="flex flex-col gap-6">
  <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
      Histórico
    </h2>
    <TimelineEvents rows={timelineData ?? []} tipoEntidade="afastamento" />
  </section>
</aside>
```

Replace it with:

```tsx
<aside className="flex flex-col gap-4">
  <ComentariosCard
    afastamentoId={row.id}
    comentarios={comentariosData ?? []}
    currentUserId={user?.id ?? ""}
    isAdmin={isAdmin}
  />
  <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
      Histórico
    </h2>
    <TimelineEvents rows={timelineData ?? []} tipoEntidade="afastamento" />
  </section>
</aside>
```

- [ ] **Step 7: Check TypeScript compiles across all changed files**

```bash
npx tsc --noEmit 2>&1 | grep -E "afastamentos/\[id\]|comentarios"
```

Expected: no output.

- [ ] **Step 8: Run all tests**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 9: Manual smoke test**

1. Start dev server: `npm run dev`
2. Navigate to any afastamento detail page (`/app/afastamentos/<uuid>`)
3. Verify: right column shows "Notas internas" card on top, "Histórico" below
4. Click "Adicionar nota" — dialog opens
5. Type a note, click "Salvar nota" — toast "Nota adicionada.", comment appears in list
6. Click "Editar" (pencil icon) on the comment — dialog opens pre-filled
7. Change text, save — comment updates, shows "(editado)" label
8. Click trash icon — comment disappears, toast "Nota excluída."
9. Click "Anexar arquivo" — file picker opens; select a PDF; chip appears while uploading, then shows filename
10. Submit comment with attachment — chip appears in the comment list with preview link

- [ ] **Step 10: Commit**

```bash
git add app/app/afastamentos/[id]/page.tsx
git commit -m "feat(afastamentos): integrate ComentariosCard into detail page"
```
