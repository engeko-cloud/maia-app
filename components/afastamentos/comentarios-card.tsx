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
  if (!iso) return "—";
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function ComentariosCard({
  afastamentoId,
  comentarios,
  currentUserId,
  isAdmin,
}: ComentariosCardProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleDelete(comentarioId: string) {
    setDeletingId(comentarioId);
    try {
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
    } finally {
      setDeletingId(null);
    }
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
                        disabled={deletingId === c.id}
                        className="text-xs text-[var(--color-danger)] hover:opacity-70 disabled:opacity-50"
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
