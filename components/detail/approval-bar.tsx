"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, XIcon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AfastamentoEditDialog, type AfastamentoEditDialogProps } from "@/components/afastamentos/afastamento-edit-dialog";

interface ApprovalBarProps {
  /** Afastamento ID — used to build API URLs. */
  afastamentoId: string;
  editProps?: {
    tipos: { id: string; rotulo: string }[];
    unidades: { id: string; nome: string }[];
    initialValues: AfastamentoEditDialogProps["initialValues"];
  };
}

export function ApprovalBar({ afastamentoId, editProps }: ApprovalBarProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [open, setOpen] = React.useState(false);

  async function aprovar() {
    setBusy(true);
    const r = await fetch(`/api/afastamentos/${afastamentoId}/aprovar`, { method: "POST" });
    if (!r.ok) {
      setBusy(false);
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao aprovar.");
      return;
    }
    toast.success("Aprovado.");
    router.refresh();
  }

  async function rejeitar() {
    if (!motivo.trim()) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    setBusy(true);
    const r = await fetch(`/api/afastamentos/${afastamentoId}/rejeitar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    if (!r.ok) {
      setBusy(false);
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao rejeitar.");
      return;
    }
    toast.success("Rejeitado.");
    setOpen(false);
    setMotivo("");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-accent-soft)] px-4 py-3">
      <div className="flex flex-col">
        <p className="text-sm font-semibold text-foreground">Este afastamento aguarda sua aprovação.</p>
        <p className="text-xs text-[var(--color-fg-muted)]">
          Revise os dados do colaborador e o anexo antes de aprovar ou rejeitar.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {editProps && (
          <AfastamentoEditDialog
            afastamentoId={afastamentoId}
            tipos={editProps.tipos}
            unidades={editProps.unidades}
            initialValues={editProps.initialValues}
          />
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" disabled={busy}>
                <XIcon className="size-4" aria-hidden="true" />
                Rejeitar
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar afastamento</DialogTitle>
              <DialogDescription>
                O colaborador receberá um link para corrigir e reenviar.
              </DialogDescription>
            </DialogHeader>
            <Label htmlFor="motivo">Motivo da rejeição</Label>
            <Textarea
              id="motivo"
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: CID ilegível, datas inconsistentes…"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={rejeitar} disabled={busy} className="bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90">
                Confirmar rejeição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          onClick={aprovar}
          disabled={busy}
          className="bg-[var(--color-success)] text-white hover:bg-[var(--color-success)]/90"
        >
          <CheckIcon className="size-4" aria-hidden="true" />
          Aprovar
        </Button>
      </div>
    </div>
  );
}
