"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/detail/stepper";

const STEPS = [
  { key: "contexto",  label: "Contexto" },
  { key: "causas",    label: "Causas" },
  { key: "acoes",     label: "Ações corretivas" },
  { key: "conclusao", label: "Conclusão" },
] as const;

type DadosShape = {
  contexto?:  string;
  causas?:    string;
  acoes?:     string;
  conclusao?: string;
};

interface InvestigacaoFormProps {
  ocorrenciaId: string;
  initialDados: DadosShape;
}

export function InvestigacaoForm({ ocorrenciaId, initialDados }: InvestigacaoFormProps) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [dados, setDados] = React.useState<DadosShape>(initialDados);
  const [busy, setBusy] = React.useState(false);

  async function persist(opts: { finalize?: boolean }) {
    setBusy(true);
    const r = await fetch(`/api/ocorrencias/${ocorrenciaId}/investigacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dados,
        situacao: opts.finalize ? "finalizada" : "em_andamento",
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Erro ao salvar.");
      return false;
    }
    return true;
  }

  async function onSave() {
    if (await persist({ finalize: false })) {
      toast.success("Progresso salvo.");
      router.refresh();
    }
  }

  async function onNext() {
    if (await persist({ finalize: false })) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  }

  async function onConclude() {
    if (await persist({ finalize: true })) {
      toast.success("Investigação concluída.");
      router.push(`/ocorrencias/${ocorrenciaId}`);
    }
  }

  const current = STEPS[step]!.key;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={STEPS.map((s) => ({ label: s.label }))} current={step} />

      <section className="rounded-md border border-[var(--color-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          {STEPS[step]!.label}
        </h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor={current}>
            {current === "contexto"  && "Descreva o que aconteceu, quando e onde."}
            {current === "causas"    && "Liste as causas identificadas (técnicas, organizacionais, humanas)."}
            {current === "acoes"     && "Quais ações corretivas serão tomadas? Por quem e até quando?"}
            {current === "conclusao" && "Resumo final e lições aprendidas."}
          </Label>
          <Textarea
            id={current}
            rows={8}
            value={dados[current] ?? ""}
            onChange={(e) => setDados({ ...dados, [current]: e.target.value })}
            placeholder="Digite aqui…"
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={busy || step === 0}
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Anterior
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onSave} disabled={busy}>
            Salvar progresso
          </Button>
          {isLast ? (
            <Button
              onClick={onConclude}
              disabled={busy}
              className="bg-[var(--color-success)] text-white hover:bg-[var(--color-success)]/90"
            >
              <CheckIcon className="size-4" aria-hidden="true" />
              Concluir investigação
            </Button>
          ) : (
            <Button onClick={onNext} disabled={busy}>
              Próximo
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
