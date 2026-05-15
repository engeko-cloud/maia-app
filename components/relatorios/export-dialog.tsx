"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EmpresaOption = { id: string; nome: string };
export type UnidadeOption = { id: string; nome: string };

interface ExportDialogProps {
  domain: "afastamentos" | "ocorrencias";
  empresas: EmpresaOption[];
  unidades: UnidadeOption[];
}

const ALL = "__all__";

export function ExportDialog({ domain, empresas, unidades }: ExportDialogProps) {
  const [open, setOpen]           = useState(false);
  const [empresaId, setEmpresaId] = useState(ALL);
  const [unidadeId, setUnidadeId] = useState(ALL);
  const [cpf, setCpf]             = useState("");
  const [dataDe, setDataDe]       = useState("");
  const [dataAte, setDataAte]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState("");

  const domainLabel = domain === "afastamentos" ? "Afastamentos" : "Ocorrências";
  const dateLabel   = domain === "afastamentos" ? "Início" : "Ocorrência";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const selectedEmpresa = empresas.find((x) => x.id === empresaId);
    const selectedUnidade = unidades.find((x) => x.id === unidadeId);

    try {
      const res = await fetch(`/api/relatorios/${domain}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id:   empresaId !== ALL ? empresaId : undefined,
          empresa_nome: selectedEmpresa?.nome,
          unidade_id:   unidadeId !== ALL ? unidadeId : undefined,
          unidade_nome: selectedUnidade?.nome,
          cpf:          cpf.trim() || undefined,
          data_de:      dataDe || undefined,
          data_ate:     dataAte || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao gerar relatório.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setDone(false);
      setError("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-foreground hover:border-[var(--color-fg-muted)] transition-colors"
          >
            <DownloadIcon className="size-4" aria-hidden="true" />
            Exportar
          </button>
        }
      />

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar {domainLabel}</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center">
            <p className="text-sm text-[var(--color-fg-muted)]">
              Relatório enviado para o seu e-mail.
            </p>
            <button
              type="button"
              className="mt-4 text-sm font-medium text-[var(--brand-primary-600)] hover:underline"
              onClick={() => setDone(false)}
            >
              Exportar novamente
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`export-empresa-${domain}`}>Empresa</Label>
              <Select value={empresaId} onValueChange={(v) => setEmpresaId(v ?? ALL)}>
                <SelectTrigger id={`export-empresa-${domain}`}>
                  <SelectValue placeholder="Todas as empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as empresas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`export-unidade-${domain}`}>Unidade</Label>
              <Select value={unidadeId} onValueChange={(v) => setUnidadeId(v ?? ALL)}>
                <SelectTrigger id={`export-unidade-${domain}`}>
                  <SelectValue placeholder="Todas as unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as unidades</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`export-cpf-${domain}`}>CPF do colaborador</Label>
              <Input
                id={`export-cpf-${domain}`}
                placeholder="Todos"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                maxLength={11}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`export-data-de-${domain}`}>{dateLabel} de</Label>
                <Input
                  id={`export-data-de-${domain}`}
                  type="date"
                  value={dataDe}
                  onChange={(e) => setDataDe(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`export-data-ate-${domain}`}>{dateLabel} até</Label>
                <Input
                  id={`export-data-ate-${domain}`}
                  type="date"
                  value={dataAte}
                  onChange={(e) => setDataAte(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-foreground transition-colors"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-[var(--brand-primary-600)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--brand-primary-700)] disabled:opacity-50 transition-colors"
              >
                {loading ? "Gerando…" : "Enviar relatório"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
