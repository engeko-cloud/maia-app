"use client";

import * as React from "react";
import { toast } from "sonner";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Resolved = {
  cpf: string;
  nome: string;
  setor: string;
  cargo: string;
  codigo_soc: string;
  empresa_id?: string;
  unidade_id?: string | null;
};

export function CpfLookup({
  empresaId,
  onResolved,
  resolveUnidade = true,
}: {
  empresaId?: string;
  onResolved: (data: Resolved) => void;
  resolveUnidade?: boolean;
}) {
  const [cpf, setCpf] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function lookup() {
    if (!empresaId) {
      toast.error("Selecione a empresa antes.");
      return;
    }
    if (!/^\d{11}$/.test(cpf)) {
      toast.error("CPF inválido");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/public/afastamentos/lookup-cpf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, cpf }),
      });
      if (!res.ok) {
        toast.error("Erro ao consultar SOC");
        return;
      }
      const data = await res.json();
      if (!data) {
        toast.error("CPF não encontrado nesta empresa");
        return;
      }
      onResolved(resolveUnidade ? data : { ...data, unidade_id: null });
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || !empresaId;

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
        disabled={!empresaId}
      />
      <Button type="button" onClick={lookup} disabled={disabled}>
        <SearchIcon className="size-4" aria-hidden="true" />
        {loading ? "Buscando…" : "Buscar"}
      </Button>
    </div>
  );
}
