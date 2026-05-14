"use client";

import * as React from "react";
import { toast } from "sonner";
import { UploadIcon } from "lucide-react";

export function FileUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = React.useState(false);
  const [filename, setFilename] = React.useState<string | null>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFilename(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/public/afastamentos/upload", { method: "POST", body: fd });
      if (!res.ok) {
        toast.error("Erro no upload");
        setFilename(null);
        return;
      }
      const { url } = await res.json();
      onUploaded(url);
    } catch {
      toast.error("Erro de rede.");
      setFilename(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] p-4 text-sm hover:border-[var(--brand-primary-600)] hover:bg-[var(--brand-primary-50)]">
      <UploadIcon className="size-5 text-[var(--color-fg-muted)]" aria-hidden="true" />
      <span className="flex flex-col">
        <span className="font-medium text-foreground">
          {uploading ? "Enviando…" : filename ?? "Selecionar anexo"}
        </span>
        <span className="text-xs text-[var(--color-fg-muted)]">PDF / JPG / PNG, até 10MB</span>
      </span>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handle}
        disabled={uploading}
        className="sr-only"
      />
    </label>
  );
}
