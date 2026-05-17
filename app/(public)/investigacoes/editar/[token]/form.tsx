"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/detail/stepper";
import { IshikawaBranchEditor } from "@/components/investigacoes/ishikawa-branch-editor";
import { ActionItemEditor } from "@/components/investigacoes/action-item-editor";
import { ParticipanteList } from "@/components/investigacoes/participante-list";
import { FotoUploader } from "@/components/investigacoes/foto-uploader";
import {
  InvestigacaoDadosSchema,
  type InvestigacaoDados,
} from "@/lib/investigacao-dados";
import { STEP_GATES, gatePassesUpTo } from "@/lib/investigacao-step-gates";

interface Categoria { id: string; codigo: string; rotulo: string; ativo: boolean; }
interface Grau      { id: string; codigo: string; rotulo: string; ativo: boolean; }

interface Props {
  token: string;
  situacao: string;
  initialDados: InvestigacaoDados;
  ocorrencia: {
    tipo: string;
    data_ocorrencia: string;
    empresa_nome: string;
    unidade_nome: string;
    colaborador_nome: string | null;
    token_edicao: string;
  };
  categorias: Categoria[];
  graus: Grau[];
  causasByCategoria: Record<string, Array<{ id: string; texto: string }>>;
}

const STEP_LABELS = ["Ishikawa", "Plano de ação", "Participantes", "Fotos"] as const;
const LAST = STEP_LABELS.length - 1;

const READ_ONLY_SITUACOES = new Set(["em_aprovacao", "aprovada", "cancelada"]);

export function PublicInvestigacaoForm({
  token, situacao, initialDados, ocorrencia, categorias, graus, causasByCategoria,
}: Props) {
  const router = useRouter();
  const readOnly = READ_ONLY_SITUACOES.has(situacao);

  const [step, setStep] = React.useState(0);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [busy, setBusy] = React.useState(false);

  const form = useForm<InvestigacaoDados>({
    resolver: zodResolver(InvestigacaoDadosSchema),
    defaultValues: initialDados,
    mode: "onSubmit",
  });

  // Seed empty branches for every active categoria so the editor always shows all 6Ms.
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
        ...missing.map((c) => ({
          categoria_id: c.id, grau_id: null, causas: [] as Array<{ causa_id?: string; descricao: string }>,
        })),
      ], { shouldDirty: false });
    }
  }, [activeCategorias, form]);

  const planoAcao = useFieldArray({ control: form.control, name: "plano_acao" });

  // Autosave debounced.
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSave = React.useCallback(async (dados: InvestigacaoDados) => {
    const res = await fetch(`/api/public/investigacoes/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dados }),
    });
    if (res.ok) setSavedAt(new Date());
  }, [token]);

  React.useEffect(() => {
    if (readOnly) return;
    const sub = form.watch((value) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        // Strip empty ishikawa branches before persisting (matches admin form).
        const cleaned: InvestigacaoDados = {
          ...(value as InvestigacaoDados),
          ishikawa: ((value.ishikawa ?? []) as InvestigacaoDados["ishikawa"]).map((b) => ({
            ...b,
            causas: (b.causas ?? []).filter((c) => c.descricao.trim().length > 0),
          })).filter((b) => b.causas.length > 0),
        };
        void flushSave(cleaned);
      }, 800);
    });
    return () => {
      sub.unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, flushSave, readOnly]);

  const dados = form.watch();
  const currentGate = STEP_GATES[step];
  const canAdvance = currentGate.min(dados);

  async function submeter() {
    if (readOnly) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/public/investigacoes/${token}/submeter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados: form.getValues() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("Investigação enviada para aprovação.");
      router.push(`/ocorrencias/status/${ocorrencia.token_edicao}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setBusy(false);
    }
  }

  const categoriaRotulo = React.useCallback(
    (id: string) => categorias.find((c) => c.id === id)?.rotulo ?? "Categoria removida",
    [categorias],
  );
  const categoriaActive = React.useCallback(
    (id: string) => categorias.find((c) => c.id === id)?.ativo ?? false,
    [categorias],
  );

  return (
    <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
      <Stepper
        current={step}
        steps={STEP_LABELS.map((s) => ({ label: s }))}
        onStepClick={readOnly ? undefined : (i) => {
          if (i === 0 || gatePassesUpTo(dados, i - 1)) setStep(i);
        }}
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
                    causas={causasByCategoria[b.categoria_id] ?? []}
                    onChange={field.onChange}
                    readOnly={readOnly || !present || !active}
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
                  onRemove={readOnly ? () => {} : () => planoAcao.remove(idx)}
                />
              )}
            />
          ))}
          {readOnly ? null : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => planoAcao.append({ acao: "", responsavel: "", prazo: "", status: "pendente" })}
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              Adicionar ação
            </Button>
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <Controller
          control={form.control}
          name="participantes"
          render={({ field }) => (
            <ParticipanteList items={field.value} onChange={readOnly ? () => {} : field.onChange} />
          )}
        />
      ) : null}

      {step === 3 ? (
        <Controller
          control={form.control}
          name="fotos"
          render={({ field }) => (
            <FotoUploader
              ocorrenciaId={ocorrencia.token_edicao /* legacy prop name */}
              items={field.value}
              onChange={readOnly ? () => {} : field.onChange}
              uploadUrl={`/api/public/investigacoes/${token}/foto`}
            />
          )}
        />
      ) : null}

      <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
            Voltar
          </Button>
          {step < LAST ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy || (!readOnly && !canAdvance)}
              title={!readOnly && !canAdvance ? currentGate.message : undefined}
              onClick={() => setStep((s) => s + 1)}
            >
              Avançar
            </Button>
          ) : (
            !readOnly && (
              <Button type="button" disabled={busy} onClick={() => void submeter()}>
                Enviar para aprovação
              </Button>
            )
          )}
        </div>
        {readOnly ? (
          <span className="text-sm text-[var(--color-fg-muted)]">Somente leitura.</span>
        ) : (
          <span className="text-sm text-[var(--color-fg-muted)]">
            {savedAt ? `Salvo às ${savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Salvando automaticamente."}
          </span>
        )}
      </div>
    </form>
  );
}
