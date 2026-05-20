"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AfastamentoInputSchema, type AfastamentoInput } from "@/lib/validation/afastamento";
import {
  calcDataFim,
  duracaoFixa,
  tipoGrupo,
  type TipoGrupo,
} from "@/lib/afastamento-tipo-rules";
import { FileUpload } from "./file-upload";
import { CpfLookup } from "./cpf-lookup";
import { FormErrors } from "./form-errors";
import { maskCid } from "@/lib/cid-mask";

const FIELD_LABELS: Record<string, string> = {
  empresa_id:       "Empresa",
  unidade_id:       "Unidade",
  tipo_id:          "Tipo de afastamento",
  cpf:              "CPF",
  colaborador_nome: "Nome do colaborador",
  data_inicio:      "Data início",
  data_fim:         "Data fim",
  hora_inicio:      "Hora início",
  hora_fim:         "Hora fim",
  duracao:          "Duração (dias)",
  cid:              "CID",
  "emissor.tipo":   "Emissor (tipo)",
  "emissor.no":     "Emissor (nº)",
  "emissor.uf":     "Emissor (UF)",
  email_remetente:  "Email para retorno",
  ocorrencia_id:    "Ocorrência vinculada",
  arquivo_url:      "Anexo",
};

type Lookups = {
  empresas: { id: string; nome: string }[];
  unidades: { id: string; nome: string }[];
  tipos:    { id: string; codigo: string; rotulo: string }[];
};

const CALCULATED_TIPO_CODIGOS = new Set(["prev_31", "prev_91"]);
const EMISSOR_TIPOS = [
  { value: "CRM", label: "CRM" },
  { value: "CRO", label: "CRO" },
];
const CATEGORIA_ITEMS = [
  { value: "atestado", label: "Atestado médico" },
  { value: "declaracao", label: "Declaração" },
];

export function AfastamentoForm({
  lookups,
  initial,
}: {
  lookups: Lookups;
  initial?: Partial<AfastamentoInput> & { token?: string };
}) {
  const router = useRouter();
  const defaultTipoId = React.useMemo(
    () => lookups.tipos.find((t) => t.codigo === "doenca")?.id,
    [lookups.tipos],
  );
  const form = useForm<AfastamentoInput>({
    resolver: zodResolver(AfastamentoInputSchema),
    defaultValues: {
      ...(initial as Partial<AfastamentoInput> | undefined),
      tipo_id: initial?.tipo_id ?? defaultTipoId,
    } as AfastamentoInput,
  });
  const [arquivoUrl, setArquivoUrl] = React.useState<string | undefined>(initial?.arquivo_url);
  const [categoria, setCategoria] = React.useState<"atestado" | "declaracao">(() => {
    if (!initial?.tipo_id) return "atestado";
    const cod = lookups.tipos.find((t) => t.id === initial.tipo_id)?.codigo;
    return tipoGrupo(cod) === "medico" ? "atestado" : "declaracao";
  });

  const empresaId = form.watch("empresa_id");
  const unidadeId = form.watch("unidade_id");
  const tipoId = form.watch("tipo_id");
  const colaboradorNome = form.watch("colaborador_nome");
  const cpf = form.watch("cpf");
  const dataInicio = form.watch("data_inicio");
  const duracao = form.watch("duracao");
  const emissorTipo = form.watch("emissor.tipo");
  const internacao = form.watch("internacao");
  const ocorrenciaId = form.watch("ocorrencia_id");

  const empresaItems = React.useMemo(
    () => lookups.empresas.map((e) => ({ value: e.id, label: e.nome })),
    [lookups.empresas],
  );
  // prev_31 / prev_91 são tipos previdenciários calculados pelo sistema e não
  // devem aparecer no dropdown. Mantemos visível apenas se já estiverem
  // selecionados no registro (form de edição), para o rótulo continuar válido.
  const tipoItems = React.useMemo(
    () =>
      lookups.tipos
        .filter((t) => !CALCULATED_TIPO_CODIGOS.has(t.codigo) || t.id === tipoId)
        .filter((t) => {
          const g = tipoGrupo(t.codigo);
          return categoria === "atestado" ? g === "medico" : g !== "medico";
        })
        .map((t) => ({ value: t.id, label: t.rotulo })),
    [lookups.tipos, tipoId, categoria],
  );

  const unidadeNome = React.useMemo(
    () => lookups.unidades.find((u) => u.id === unidadeId)?.nome ?? "",
    [lookups.unidades, unidadeId],
  );

  const tipoCodigo = React.useMemo(
    () => lookups.tipos.find((t) => t.id === tipoId)?.codigo,
    [lookups.tipos, tipoId],
  );
  const grupo: TipoGrupo = tipoGrupo(tipoCodigo);
  const fixa = duracaoFixa(tipoCodigo);

  // Ocorrências disponíveis para vincular (apenas codigo=acidente).
  type OcorrenciaOption = { id: string; tipo: string; data_ocorrencia: string; descricao: string | null };
  const [ocorrenciasDisp, setOcorrenciasDisp] = React.useState<OcorrenciaOption[]>([]);
  React.useEffect(() => {
    if (tipoCodigo !== "acidente" || !empresaId || !cpf || !/^\d{11}$/.test(cpf)) {
      setOcorrenciasDisp([]);
      return;
    }
    let aborted = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ empresa_id: empresaId, cpf });
        const res = await fetch(`/api/public/afastamentos/ocorrencias-disponiveis?${qs}`);
        if (!res.ok) return;
        const data = (await res.json()) as OcorrenciaOption[];
        if (!aborted) setOcorrenciasDisp(data);
      } catch {
        if (!aborted) setOcorrenciasDisp([]);
      }
    })();
    return () => { aborted = true; };
  }, [tipoCodigo, empresaId, cpf]);

  const ocorrenciaItems = React.useMemo(
    () =>
      ocorrenciasDisp.map((o) => ({
        value: o.id,
        label: `${o.data_ocorrencia.slice(0, 10)} • ${o.tipo}${o.descricao ? ` — ${o.descricao.slice(0, 60)}` : ""}`,
      })),
    [ocorrenciasDisp],
  );

  // Para declaração fixa, a duração é definida pelo código do tipo.
  // Para médico, a duração é digitada e a data_fim é derivada.
  const dataFimDerivada = React.useMemo(() => {
    if (grupo === "medico" && dataInicio && duracao && duracao > 0) {
      return calcDataFim(dataInicio, duracao);
    }
    if (grupo === "declaracao_fixa" && dataInicio && fixa) {
      return calcDataFim(dataInicio, fixa);
    }
    if (grupo === "declaracao_hora" && dataInicio) {
      return dataInicio;
    }
    return undefined;
  }, [grupo, dataInicio, duracao, fixa]);

  const duracaoEfetiva = React.useMemo(() => {
    if (grupo === "declaracao_fixa") return fixa;
    if (grupo === "declaracao_hora") return 0;
    return duracao;
  }, [grupo, fixa, duracao]);

  function handleTipoChange(tipoIdValue: string) {
    form.setValue("tipo_id", tipoIdValue, { shouldValidate: true });
    const newCodigo = lookups.tipos.find((t) => t.id === tipoIdValue)?.codigo;
    const newGrupo = tipoGrupo(newCodigo);
    if (newGrupo !== "medico") {
      form.setValue("emissor", undefined as any);
      form.setValue("cid", undefined);
      form.setValue("internacao", undefined);
      form.setValue("ocorrencia_id", undefined);
      form.setValue("duracao", undefined);
    }
    if (newGrupo !== "declaracao_hora") {
      form.setValue("hora_inicio", undefined);
      form.setValue("hora_fim", undefined);
    }
  }

  function handleCategoriaChange(v: string) {
    const newCategoria = v as "atestado" | "declaracao";
    setCategoria(newCategoria);
    const firstTipo = lookups.tipos.find((t) => {
      if (CALCULATED_TIPO_CODIGOS.has(t.codigo)) return false;
      const g = tipoGrupo(t.codigo);
      return newCategoria === "atestado" ? g === "medico" : g !== "medico";
    });
    if (firstTipo) handleTipoChange(firstTipo.id);
  }

  async function onSubmit(values: AfastamentoInput) {
    if (!arquivoUrl) {
      form.setError("arquivo_url", {
        type: "required",
        message: "Anexo obrigatório (atestado, declaração ou documento equivalente).",
      });
      toast.error("Anexe o documento antes de enviar.");
      return;
    }
    const codigo = lookups.tipos.find((t) => t.id === values.tipo_id)?.codigo;
    if (codigo === "acidente" && ocorrenciaItems.length > 0 && !values.ocorrencia_id) {
      form.setError("ocorrencia_id", {
        type: "required",
        message: "Selecione a ocorrência vinculada ao acidente de trabalho.",
      });
      toast.error("Verifique os campos destacados.");
      return;
    }
    const g = tipoGrupo(codigo);

    let finalDuracao = values.duracao;
    let finalDataFim = values.data_fim;

    if (g === "declaracao_fixa") {
      const dur = duracaoFixa(codigo);
      finalDuracao = dur;
      finalDataFim = dur && values.data_inicio ? calcDataFim(values.data_inicio, dur) : undefined;
    } else if (g === "declaracao_hora") {
      finalDuracao = 0;
      finalDataFim = values.data_inicio;
    } else if (g === "medico") {
      finalDataFim = values.duracao && values.data_inicio
        ? calcDataFim(values.data_inicio, values.duracao)
        : undefined;
    }

    const payload: AfastamentoInput = {
      ...values,
      duracao: finalDuracao,
      data_fim: finalDataFim,
      acidente: codigo === "acidente" ? true : values.acidente ?? false,
      arquivo_url: arquivoUrl,
    };

    const url = initial?.token
      ? `/api/public/afastamentos/${initial.token}`
      : "/api/public/afastamentos";
    const method = initial?.token ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Erro" }));
        toast.error(error ?? "Erro");
        return;
      }
      toast.success("Enviado.");
      router.push("/");
    } catch {
      toast.error("Erro de rede.");
    }
  }

  function onInvalid() {
    toast.error("Verifique os campos destacados.");
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      className="flex flex-col gap-5"
    >
      <FormErrors errors={form.formState.errors} labels={FIELD_LABELS} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="empresa_id">Empresa</Label>
        <Select
          items={empresaItems}
          value={empresaId ?? ""}
          onValueChange={(v) => form.setValue("empresa_id", v as string, { shouldValidate: true })}
        >
          <SelectTrigger id="empresa_id" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {empresaItems.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>CPF</Label>
        <CpfLookup
          empresaId={empresaId}
          onResolved={(data) => {
            form.setValue("cpf", data.cpf);
            form.setValue("colaborador_nome", data.nome, { shouldValidate: true });
            form.setValue("colaborador_setor", data.setor);
            form.setValue("colaborador_cargo", data.cargo);
            form.setValue("colaborador_codigo_soc", data.codigo_soc);
            if (data.unidade_id) form.setValue("unidade_id", data.unidade_id, { shouldValidate: true });
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="colaborador_nome">Nome do colaborador</Label>
        <Input
          id="colaborador_nome"
          value={colaboradorNome ?? ""}
          readOnly
          tabIndex={-1}
          placeholder="Preenchido pela busca do CPF"
          className="bg-muted/40 text-muted-foreground"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unidade_nome">Unidade</Label>
        <Input
          id="unidade_nome"
          value={unidadeNome}
          readOnly
          tabIndex={-1}
          placeholder="Resolvida pela busca do CPF"
          className="bg-muted/40 text-muted-foreground"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Tipo de documento</Label>
        <Select
          items={CATEGORIA_ITEMS}
          value={categoria}
          onValueChange={(v) => v && handleCategoriaChange(v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIA_ITEMS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo_id">Tipo de afastamento</Label>
        <Select
          items={tipoItems}
          value={tipoId ?? ""}
          onValueChange={(v) => handleTipoChange(v as string)}
        >
          <SelectTrigger id="tipo_id" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {tipoItems.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {grupo === "medico" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data_inicio">Data início</Label>
              <Input id="data_inicio" type="date" {...form.register("data_inicio")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="duracao">Duração (dias)</Label>
              <Input
                id="duracao"
                type="number"
                min={1}
                inputMode="numeric"
                {...form.register("duracao", { valueAsNumber: true })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data_fim">Data fim</Label>
              <Input
                id="data_fim"
                type="date"
                value={dataFimDerivada ?? ""}
                readOnly
                tabIndex={-1}
                placeholder="Calculada"
                className="bg-muted/40 text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cid">CID (opcional)</Label>
            {(() => {
              const cidField = form.register("cid");
              return (
                <Input
                  id="cid"
                  placeholder="X00"
                  maxLength={3}
                  inputMode="text"
                  autoCapitalize="characters"
                  className="font-mono uppercase"
                  {...cidField}
                  onChange={(e) => {
                    e.target.value = maskCid(e.target.value);
                    cidField.onChange(e);
                  }}
                />
              );
            })()}
          </div>

          <fieldset className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] p-3">
            <legend className="px-1 text-sm font-medium">Emissor</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emissor_tipo">Tipo</Label>
                <Select
                  items={EMISSOR_TIPOS}
                  value={emissorTipo ?? ""}
                  onValueChange={(v) =>
                    form.setValue("emissor.tipo", v as "CRM" | "CRO", { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="emissor_tipo" className="w-full">
                    <SelectValue placeholder="CRM/CRO" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMISSOR_TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emissor_no">Nº</Label>
                <Input id="emissor_no" {...form.register("emissor.no")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emissor_uf">UF</Label>
                {(() => {
                  const ufField = form.register("emissor.uf");
                  return (
                    <Input
                      id="emissor_uf"
                      maxLength={2}
                      className="uppercase"
                      {...ufField}
                      onChange={(e) => {
                        e.target.value = e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase();
                        ufField.onChange(e);
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={!!internacao}
              onCheckedChange={(v) =>
                form.setValue("internacao", Boolean(v), { shouldDirty: true })
              }
            />
            Internação hospitalar
          </label>

          {tipoCodigo === "acidente" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ocorrencia_id">Ocorrência vinculada</Label>
              {ocorrenciaItems.length === 0 ? (
                <p className="text-xs text-[var(--color-fg-muted)]">
                  Nenhuma ocorrência disponível para vincular. Registre a ocorrência primeiro.
                </p>
              ) : (
                <Select
                  items={ocorrenciaItems}
                  value={ocorrenciaId ?? ""}
                  onValueChange={(v) =>
                    form.setValue("ocorrencia_id", v as string, { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="ocorrencia_id" className="w-full">
                    <SelectValue placeholder="Selecione a ocorrência relacionada" />
                  </SelectTrigger>
                  <SelectContent>
                    {ocorrenciaItems.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </>
      )}

      {grupo === "declaracao_hora" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="data_inicio">Data do documento</Label>
            <Input id="data_inicio" type="date" {...form.register("data_inicio")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hora_inicio">Hora início</Label>
              <Input id="hora_inicio" type="time" {...form.register("hora_inicio")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hora_fim">Hora fim</Label>
              <Input id="hora_fim" type="time" {...form.register("hora_fim")} />
            </div>
          </div>
        </>
      )}

      {grupo === "declaracao_fixa" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="data_inicio">Data do documento</Label>
            <Input id="data_inicio" type="date" {...form.register("data_inicio")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Duração (dias)</Label>
              <Input
                value={duracaoEfetiva ?? ""}
                readOnly
                tabIndex={-1}
                className="bg-muted/40 text-muted-foreground"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data_fim">Data fim</Label>
              <Input
                id="data_fim"
                type="date"
                value={dataFimDerivada ?? ""}
                readOnly
                tabIndex={-1}
                placeholder="Calculada"
                className="bg-muted/40 text-muted-foreground"
              />
            </div>
          </div>
        </>
      )}

      {grupo === "outro" && tipoId && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="data_inicio">Data início</Label>
            <Input id="data_inicio" type="date" {...form.register("data_inicio")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="data_fim">Data fim</Label>
            <Input id="data_fim" type="date" {...form.register("data_fim")} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email_remetente">Email para retorno</Label>
        <Input id="email_remetente" type="email" {...form.register("email_remetente")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Anexo *</Label>
        <FileUpload
          onUploaded={(url) => {
            setArquivoUrl(url);
            form.clearErrors("arquivo_url");
          }}
        />
        {arquivoUrl && (
          <p className="text-xs text-[var(--color-fg-muted)]">Anexo carregado.</p>
        )}
      </div>

      <Button type="submit" disabled={form.formState.isSubmitting}>
        Enviar
      </Button>
    </form>
  );
}
