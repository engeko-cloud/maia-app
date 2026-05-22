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
} from "@/components/ui/select";

export type EmpresaOption = { id: string; nome: string };
export type UnidadeOption = { id: string; nome: string };

interface ExportDialogProps {
  domain: "afastamentos" | "ocorrencias";
  empresas: EmpresaOption[];
  unidades: UnidadeOption[];
}

type FilterType = "empresa" | "unidade" | "cpf";

const FILTER_LABELS: Record<FilterType, string> = {
  empresa: "Empresa",
  unidade: "Unidade",
  cpf:     "CPF",
};

const ALL = "__all__";

export function ExportDialog({ domain, empresas, unidades }: ExportDialogProps) {
  const [open, setOpen]           = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("empresa");
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

  function resetFilters() {
    setFilterType("empresa");
    setEmpresaId(ALL);
    setUnidadeId(ALL);
    setCpf("");
    setDataDe("");
    setDataAte("");
  }

  function handleFilterTypeChange(t: FilterType) {
    setFilterType(t);
    setEmpresaId(ALL);
    setUnidadeId(ALL);
    setCpf("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const selectedEmpresa = empresas.find((x) => x.id === empresaId);
    const selectedUnidade = unidades.find((x) => x.id === unidadeId);

    const body: Record<string, string | undefined> = {
      data_de:  dataDe || undefined,
      data_ate: dataAte || undefined,
    };
    if (filterType === "empresa" && empresaId !== ALL) {
      body.empresa_id   = empresaId;
      body.empresa_nome = selectedEmpresa?.nome;
    }
    if (filterType === "unidade" && unidadeId !== ALL) {
      body.unidade_id   = unidadeId;
      body.unidade_nome = selectedUnidade?.nome;
    }
    if (filterType === "cpf" && cpf.trim()) {
      body.cpf = cpf.trim();
    }

    try {
      const res = await fetch(`/api/relatorios/${domain}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let message = "Erro ao gerar relatório.";
        try { const json = await res.json(); message = json.error ?? message; } catch { /* non-JSON */ }
        setError(message);
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
    if (!v) { resetFilters(); setDone(false); setError(""); }
  }

  const selectedEmpresaNome = empresas.find((e) => e.id === empresaId)?.nome;
  const selectedUnidadeNome = unidades.find((u) => u.id === unidadeId)?.nome;

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
              onClick={() => { resetFilters(); setDone(false); }}
            >
              Exportar novamente
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">

            {/* Filter type toggle */}
            <div className="flex flex-col gap-1.5">
              <Label>Filtrar por</Label>
              <div className="flex rounded-md border border-[var(--color-border)] overflow-hidden">
                {(["empresa", "unidade", "cpf"] as FilterType[]).map((t, i) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleFilterTypeChange(t)}
                    className={[
                      "flex-1 py-1.5 text-sm font-medium transition-colors",
                      i > 0 ? "border-l border-[var(--color-border)]" : "",
                      filterType === t
                        ? "bg-[var(--brand-primary-600)] text-white"
                        : "bg-white text-[var(--color-fg-muted)] hover:text-foreground hover:bg-[var(--color-bg-subtle,#f9fafb)]",
                    ].join(" ")}
                  >
                    {FILTER_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Active filter input */}
            {filterType === "empresa" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`export-empresa-${domain}`}>Empresa</Label>
                <Select value={empresaId} onValueChange={(v) => setEmpresaId(v ?? ALL)}>
                  <SelectTrigger id={`export-empresa-${domain}`} className="w-full">
                    <span className={selectedEmpresaNome ? "text-foreground" : "text-muted-foreground"}>
                      {selectedEmpresaNome ?? "Todas as empresas"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas as empresas</SelectItem>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterType === "unidade" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`export-unidade-${domain}`}>Unidade</Label>
                <Select value={unidadeId} onValueChange={(v) => setUnidadeId(v ?? ALL)}>
                  <SelectTrigger id={`export-unidade-${domain}`} className="w-full">
                    <span className={selectedUnidadeNome ? "text-foreground" : "text-muted-foreground"}>
                      {selectedUnidadeNome ?? "Todas as unidades"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas as unidades</SelectItem>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterType === "cpf" && (
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
            )}

            {/* Date range — always visible, concurrent with any filter */}
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

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-foreground transition-colors"
                onClick={() => handleOpenChange(false)}
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
