"use client";

import * as React from "react";
import { toast } from "sonner";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CpfLookup({ onResolved }: { onResolved: (data: { cpf: string; nome: string; setor: string; cargo: string; codigo_soc: string; empresa_id?: string; unidade_id?: string }) => void }) {
  const [cpf, setCpf] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function lookup() {
    if (!/^\d{11}$/.test(cpf)) {
      toast.error("CPF inválido");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/public/afastamentos/lookup-cpf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf }),
      });
      if (!res.ok) {
        toast.error("Erro ao consultar SOC");
        return;
      }
      const data = await res.json();
      if (!data) {
        toast.error("CPF não encontrado");
        return;
      }
      onResolved(data);
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        type="text"
        inputMode="numeric"
        placeholder="CPF (11 dígitos)"
        value={cpf}
        onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
        maxLength={11}
        className="font-mono"
      />
      <Button type="button" onClick={lookup} disabled={loading}>
        <SearchIcon className="size-4" aria-hidden="true" />
        {loading ? "Buscando…" : "Buscar"}
      </Button>
    </div>
  );
}
