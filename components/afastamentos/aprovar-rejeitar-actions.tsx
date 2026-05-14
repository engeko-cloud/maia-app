"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function AprovarRejeitarActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [motivo, setMotivo] = useState("");

  async function aprovar() {
    setBusy(true);
    const r = await fetch(`/api/afastamentos/${id}/aprovar`, { method: "POST" });
    setBusy(false);
    if (!r.ok) { const j = await r.json(); toast.error(j.error ?? "Erro"); return; }
    toast.success("Aprovado.");
    router.refresh();
  }

  async function rejeitar() {
    if (!motivo.trim()) { toast.error("Informe o motivo da rejeição."); return; }
    setBusy(true);
    const r = await fetch(`/api/afastamentos/${id}/rejeitar`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo }),
    });
    setBusy(false);
    if (!r.ok) { const j = await r.json(); toast.error(j.error ?? "Erro"); return; }
    toast.success("Rejeitado.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <button onClick={aprovar} disabled={busy}
              className="w-full bg-[var(--color-success)] text-white rounded px-3 py-2">Aprovar</button>
      <textarea className="w-full border rounded px-3 py-2" rows={3}
                placeholder="Motivo (obrigatório para rejeitar)"
                value={motivo} onChange={e => setMotivo(e.target.value)} />
      <button onClick={rejeitar} disabled={busy}
              className="w-full bg-[var(--color-danger)] text-white rounded px-3 py-2">Rejeitar</button>
    </div>
  );
}
