"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/detail/stepper";
import { IshikawaBranchEditor } from "./ishikawa-branch-editor";
import { ActionItemEditor } from "./action-item-editor";
import { ParticipanteList } from "./participante-list";
import { FotoUploader } from "./foto-uploader";
import {
  InvestigacaoDadosSchema,
  type InvestigacaoDados,
} from "@/lib/investigacao-dados";

interface Categoria { id: string; codigo: string; rotulo: string; ativo: boolean; }
interface Grau      { id: string; codigo: string; rotulo: string; ativo: boolean; }

interface Props {
  ocorrenciaId: string;
  initialDados: InvestigacaoDados;
  initialSituacao: "em_andamento" | "finalizada";
  categorias: Categoria[];
  graus:      Grau[];
}

const STEPS = ["Ishikawa", "Plano de ação", "Participantes", "Fotos"] as const;

export function InvestigacaoForm({
  ocorrenciaId, initialDados, initialSituacao, categorias, graus,
}: Props) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  const form = useForm<InvestigacaoDados>({
    resolver: zodResolver(InvestigacaoDadosSchema),
    defaultValues: initialDados,
    mode: "onSubmit",
  });

  // Ensure every ACTIVE categoria has a branch slot (without losing branches for deactivated/removed ones)
  const activeCategorias = React.useMemo(
    () => categorias.filter((c) => c.ativo).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [categorias],
  );
  React.useEffect(() => {
    const current = form.getValues("ishikawa");
    const known = new Set(current.map((b) => b.categoria_id));
    const missing = activeCategorias.filter((c) => !known.has(c.id));
    if (missing.length > 0) {
      form.setValue("ishikawa", [
        ...current,
        ...missing.map((c) => ({ categoria_id: c.id, grau_id: null, causas: [] as string[] })),
      ], { shouldDirty: false });
    }
  }, [activeCategorias, form]);

  const planoAcao = useFieldArray({ control: form.control, name: "plano_acao" });

  async function persist(situacao: "em_andamento" | "finalizada") {
    setBusy(true);
    try {
      const dados = form.getValues();
      // Strip ishikawa branches with no causes (they're "empty" slots)
      const cleanDados: InvestigacaoDados = {
        ...dados,
        ishikawa: dados.ishikawa.filter((b) => b.causas.length > 0 && b.causas.every((c) => c.trim().length > 0)),
      };
      const res = await fetch(`/api/ocorrencias/${ocorrenciaId}/investigacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados: cleanDados, situacao }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success(situacao === "finalizada" ? "Investigação finalizada." : "Rascunho salvo.");
      if (situacao === "finalizada") {
        router.push(`/ocorrencias/${ocorrenciaId}`);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  const categoriaRotulo = React.useCallback((id: string) => {
    return categorias.find((c) => c.id === id)?.rotulo ?? "Categoria removida";
  }, [categorias]);
  const categoriaActive = React.useCallback((id: string) => {
    return categorias.find((c) => c.id === id)?.ativo ?? false;
  }, [categorias]);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void persist(initialSituacao === "finalizada" ? "finalizada" : "em_andamento"); }}
      className="flex flex-col gap-6"
    >
      <Stepper
        current={step}
        steps={STEPS.map((s) => ({ label: s }))}
      />

      {step === 0 ? (
        <div className="flex flex-col gap-4">
          {form.watch("ishikawa").map((b, idx) => {
            const present = !!categorias.find((c) => c.id === b.categoria_id);
            const active  = categoriaActive(b.categoria_id);
            const readOnlyLabel = !present ? "categoria removida" : !active ? "categoria desativada" : undefined;
            return (
              <Controller
                key={`${b.categoria_id}-${idx}`}
                control={form.control}
                name={`ishikawa.${idx}`}
                render={({ field }) => (
                  <IshikawaBranchEditor
                    branch={field.value}
                    categoriaRotulo={categoriaRotulo(b.categoria_id)}
                    graus={graus.filter((g) => g.ativo)}
                    onChange={field.onChange}
                    readOnly={!present || !active}
                    readOnlyLabel={readOnlyLabel}
                  />
                )}
              />
            );
          })}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          {planoAcao.fields.map((field, idx) => (
            <Controller
              key={field.id}
              control={form.control}
              name={`plano_acao.${idx}`}
              render={({ field: f }) => (
                <ActionItemEditor
                  item={f.value}
                  index={idx}
                  onChange={f.onChange}
                  onRemove={() => planoAcao.remove(idx)}
                />
              )}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={() => planoAcao.append({ acao: "", responsavel: "", prazo: "", status: "pendente" })}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Adicionar ação
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <Controller
          control={form.control}
          name="participantes"
          render={({ field }) => (
            <ParticipanteList items={field.value} onChange={field.onChange} />
          )}
        />
      ) : null}

      {step === 3 ? (
        <Controller
          control={form.control}
          name="fotos"
          render={({ field }) => (
            <FotoUploader
              ocorrenciaId={ocorrenciaId}
              items={field.value}
              onChange={field.onChange}
            />
          )}
        />
      ) : null}

      <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
            Voltar
          </Button>
          <Button type="button" variant="secondary" disabled={step === STEPS.length - 1 || busy} onClick={() => setStep((s) => s + 1)}>
            Próximo
          </Button>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void persist("em_andamento")}>
            Salvar rascunho
          </Button>
          <Button type="button" disabled={busy} onClick={() => void persist("finalizada")}>
            Finalizar
          </Button>
        </div>
      </div>
    </form>
  );
}
