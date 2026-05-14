"use client";
import * as React from "react";
import { toast } from "sonner";
import { Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Foto = {
  path: string;
  legenda: string | null;
};

interface Props {
  ocorrenciaId: string;
  items: Foto[];
  onChange: (next: Foto[]) => void;
  /** Max fotos per investigation (default 10, enforced server-side too). */
  max?: number;
}

const ACCEPT = "image/jpeg,image/png,image/webp";

export function FotoUploader({ ocorrenciaId, items, onChange, max = 10 }: Props) {
  const [busy, setBusy] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function uploadOne(file: File) {
    if (items.length >= max) {
      toast.error(`Máximo de ${max} fotos por investigação.`);
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("ocorrencia_id", ocorrenciaId);
      const res = await fetch("/api/private/investigacoes/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const { path } = await res.json() as { path: string };
      onChange([...items, { path, legenda: null }]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setBusy(false);
    }
  }

  function setLegenda(idx: number, value: string) {
    const next = items.map((it, i) => (i === idx ? { ...it, legenda: value || null } : it));
    onChange(next);
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadOne(f);
          e.target.value = "";
        }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((foto, idx) => {
          const previewUrl = `/api/private/anexos/preview?path=${encodeURIComponent(foto.path)}`;
          return (
            <figure key={foto.path} className="rounded-md border border-[var(--color-border)] bg-white p-3">
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="block aspect-video overflow-hidden rounded-sm bg-[var(--color-bg-subtle)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt={foto.legenda ?? ""} className="size-full object-cover" />
              </a>
              <div className="mt-2 flex items-center gap-2">
                <Label htmlFor={`leg-${idx}`} className="sr-only">Legenda</Label>
                <Input
                  id={`leg-${idx}`}
                  value={foto.legenda ?? ""}
                  onChange={(e) => setLegenda(idx, e.target.value)}
                  placeholder="Legenda (opcional)"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} aria-label="Remover foto">
                  <Trash2Icon className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </figure>
          );
        })}
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={busy || items.length >= max}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadIcon className="size-4" aria-hidden="true" />
        {busy ? "Enviando…" : `Adicionar foto (${items.length}/${max})`}
      </Button>
    </div>
  );
}
