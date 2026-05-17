"use client";

import * as React from "react";
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
    if (mode === "edit" && !comentarioId) {
      toast.error("Erro interno: comentário não identificado.");
      return;
    }

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

    let r: Response;
    try {
      r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setBusy(false);
      toast.error("Erro de rede ao salvar nota.");
      return;
    }

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
    <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
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
