"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calcDataFim } from "@/lib/afastamento-date";

export interface AfastamentoEditDialogProps {
  afastamentoId: string;
  tipos: { id: string; rotulo: string }[];
  unidades: { id: string; nome: string }[];
  initialValues: {
    tipo_id: string;
    unidade_id: string | null;
    data_inicio: string;
    duracao: number | null;
    cid: string | null;
    emissor: { tipo: string; no: string; uf: string } | null;
  };
}

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50";

export function AfastamentoEditDialog({
  afastamentoId,
  tipos,
  unidades,
  initialValues,
}: AfastamentoEditDialogProps) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [tipoId, setTipoId] = React.useState(initialValues.tipo_id);
  const [unidadeId, setUnidadeId] = React.useState(initialValues.unidade_id ?? "");
  const [dataInicio, setDataInicio] = React.useState(initialValues.data_inicio);
  const [duracao, setDuracao] = React.useState(
    initialValues.duracao != null ? String(initialValues.duracao) : ""
  );
  const [cid, setCid] = React.useState(initialValues.cid ?? "");
  const [emissorTipo, setEmissorTipo] = React.useState(
    initialValues.emissor?.tipo ?? ""
  );
  const [emissorNo, setEmissorNo] = React.useState(
    initialValues.emissor?.no ?? ""
  );
  const [emissorUf, setEmissorUf] = React.useState(
    initialValues.emissor?.uf ?? ""
  );

  const dataFim = React.useMemo(() => {
    if (!dataInicio) return "—";
    const d = parseInt(duracao);
    if (!Number.isFinite(d) || d < 1) return "—";
    return calcDataFim(dataInicio, d);
  }, [dataInicio, duracao]);

  async function salvar() {
    const d = parseInt(duracao);
    if (!tipoId || !dataInicio || !Number.isFinite(d) || d < 1) {
      toast.error("Tipo, data de início e duração são obrigatórios.");
      return;
    }

    setBusy(true);

    const body = {
      tipo_id: tipoId,
      unidade_id: unidadeId || null,
      data_inicio: dataInicio,
      duracao: d,
      cid: cid.trim() || null,
      emissor: emissorTipo.trim()
        ? {
            tipo: emissorTipo.trim(),
            no: emissorNo.trim(),
            uf: emissorUf.trim().toUpperCase(),
          }
        : null,
    };

    const r = await fetch(`/api/afastamentos/${afastamentoId}/editar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setBusy(false);

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao salvar alterações.");
      return;
    }

    toast.success("Dados atualizados.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" disabled={busy}>
            <PencilIcon className="size-4" aria-hidden="true" />
            Editar dados
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar dados do afastamento</DialogTitle>
          <DialogDescription>
            Corrija campos antes de aprovar. O colaborador não é notificado desta edição.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Tipo */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-tipo">Tipo</Label>
            <select
              id="edit-tipo"
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
              className={selectClass}
            >
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </div>

          {/* Unidade */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-unidade">Unidade</Label>
            <select
              id="edit-unidade"
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              className={selectClass}
            >
              <option value="">— Sem unidade —</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Data início */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-data-inicio">Data início</Label>
            <Input
              id="edit-data-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>

          {/* Duração */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-duracao">Duração (dias)</Label>
            <Input
              id="edit-duracao"
              type="number"
              min="1"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
            />
          </div>

          {/* Data fim — full width, read-only */}
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Data fim</Label>
            <div className="h-8 w-full rounded-lg border border-input bg-muted/50 px-2.5 py-1 text-sm text-muted-foreground">
              {dataFim}
            </div>
          </div>

          {/* CID */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-cid">CID</Label>
            <Input
              id="edit-cid"
              type="text"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
            />
          </div>

          {/* Emissor — full width with 3 sub-inputs */}
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Emissor</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Tipo</span>
                <Input
                  type="text"
                  value={emissorTipo}
                  onChange={(e) => setEmissorTipo(e.target.value)}
                  placeholder="Ex.: CRM"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Número</span>
                <Input
                  type="text"
                  value={emissorNo}
                  onChange={(e) => setEmissorNo(e.target.value)}
                  placeholder="Ex.: 123456"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">UF</span>
                <Input
                  type="text"
                  value={emissorUf}
                  maxLength={2}
                  onChange={(e) =>
                    setEmissorUf(e.target.value.toUpperCase())
                  }
                  placeholder="Ex.: SP"
                />
              </div>
            </div>
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
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
