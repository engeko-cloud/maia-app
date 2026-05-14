"use client";
import { useState } from "react";
import { toast } from "sonner";

export function CpfLookup({ onResolved }: { onResolved: (data: any) => void }) {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookup() {
    if (!/^\d{11}$/.test(cpf)) { toast.error("CPF inválido"); return; }
    setLoading(true);
    const res = await fetch("/api/public/afastamentos/lookup-cpf", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cpf }),
    });
    setLoading(false);
    if (!res.ok) { toast.error("Erro ao consultar SOC"); return; }
    const data = await res.json();
    if (!data) { toast.error("CPF não encontrado"); return; }
    onResolved(data);
  }

  return (
    <div className="flex gap-2">
      <input
        className="flex-1 border rounded px-3 py-2"
        placeholder="CPF (11 dígitos)"
        value={cpf}
        onChange={e => setCpf(e.target.value.replace(/\D/g, ""))}
        maxLength={11}
      />
      <button
        type="button"
        onClick={lookup}
        disabled={loading}
        className="bg-primary text-primary-foreground rounded px-3 py-2"
      >
        {loading ? "..." : "Buscar"}
      </button>
    </div>
  );
}
