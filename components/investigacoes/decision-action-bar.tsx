"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  ocorrenciaId: string;
  situacao: string;
  tokenPublico: string;
  /** Called before any decision action: caller flushes pending edits to /investigacao route. */
  onBeforeAction: () => Promise<void>;
  busy: boolean;
  setBusy: (b: boolean) => void;
}

export function DecisionActionBar({
  ocorrenciaId, situacao, tokenPublico, onBeforeAction, busy, setBusy,
}: Props) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");

  const isReadOnly = situacao === "aprovada" || situacao === "cancelada";

  async function aprovar() {
    setBusy(true);
    try {
      await onBeforeAction();
      const res = await fetch(`/api/ocorrencias/${ocorrenciaId}/investigacao/aprovar`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      toast.success("Investigação aprovada.", {
        action: j.relatorio_url ? { label: "Ver relatório", onClick: () => window.open(j.relatorio_url, "_blank") } : undefined,
      });
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao aprovar.");
    } finally {
      setBusy(false);
    }
  }

  async function rejeitar() {
    if (motivo.trim().length < 10) {
      toast.error("O motivo precisa ter ao menos 10 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await onBeforeAction();
      const res = await fetch(`/api/ocorrencias/${ocorrenciaId}/investigacao/rejeitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo_rejeicao: motivo.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("Investigação rejeitada.");
      setRejectOpen(false);
      setMotivo("");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao rejeitar.");
    } finally {
      setBusy(false);
    }
  }

  async function reabrir() {
    if (!confirm("Reabrir esta investigação? O status voltará para 'em andamento'.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ocorrencias/${ocorrenciaId}/investigacao/reabrir`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("Investigação reaberta.");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao reabrir.");
    } finally {
      setBusy(false);
    }
  }

  const showRejeitar = situacao === "em_aprovacao" || situacao === "rejeitada";
  const showAprovar  = situacao === "em_andamento" || situacao === "em_aprovacao" || situacao === "rejeitada";
  const showReabrir  = situacao === "aprovada";
  const showRelatorio = situacao === "aprovada" || situacao === "em_aprovacao";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {showRelatorio && (
          <Link href={`/ocorrencias/relatorio/${tokenPublico}`} target="_blank">
            <Button type="button" variant="secondary">Ver relatório</Button>
          </Link>
        )}
        {showRejeitar && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setRejectOpen(true)}>
            Rejeitar
          </Button>
        )}
        {showAprovar && (
          <Button type="button" disabled={busy} onClick={() => void aprovar()}>
            Aprovar
          </Button>
        )}
        {showReabrir && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void reabrir()}>
            Reabrir
          </Button>
        )}
        {isReadOnly && !showReabrir && (
          <span className="text-sm text-[var(--color-fg-muted)]">Somente leitura.</span>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar investigação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-fg-muted)]">
            O motivo será enviado ao remetente da ocorrência por email. Mínimo 10 caracteres.
          </p>
          <textarea
            className="mt-2 w-full rounded-md border border-[var(--color-border)] p-2 text-sm"
            rows={5}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva o que precisa ser ajustado."
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setRejectOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" disabled={busy} onClick={() => void rejeitar()}>
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
