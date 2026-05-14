"use client";
import { useState } from "react";
import { toast } from "sonner";

export function FileUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/public/afastamentos/upload", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) { toast.error("Erro no upload"); return; }
    const { url } = await res.json();
    onUploaded(url);
  }

  return (
    <label className="block">
      <span className="text-sm text-muted-foreground">Anexo (PDF/JPG/PNG, máx 10MB)</span>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handle}
             disabled={uploading} className="mt-1 block w-full" />
    </label>
  );
}
