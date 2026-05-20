"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OcorrenciaInputSchema, type OcorrenciaInput } from "@/lib/validation/ocorrencia";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import TIPOS from "@/lib/data/ocorrencia_tipos.json";
import { FileUpload } from "./file-upload";
import { CpfLookup } from "./cpf-lookup";
import { FormErrors } from "./form-errors";
import { maskCid } from "@/lib/cid-mask";

const FIELD_LABELS: Record<string, string> = {
  empresa_id:       "Empresa",
  unidade_id:       "Unidade",
  tipo:             "Tipo de ocorrência",
  data_ocorrencia:  "Data do evento",
  hora_ocorrencia:  "Hora do evento",
  cpf:              "CPF da vítima",
  colaborador_nome: "Nome do colaborador",
  relacao_vitima:   "Relação da vítima",
  dut:              "Último dia trabalhado",
  descricao:        "Descrição da ocorrência",
  tipo_local:       "Tipo do local",
  cnpj_local:       "CNPJ do local",
  texto_local:      "Descrição do local",
  email_remetente:  "Email do solicitante",
  data_atendimento: "Data do atendimento",
  hora_atendimento: "Hora do atendimento",
  duracao_afastamento: "Duração do afastamento",
  cid:              "CID",
  "emissor.tipo":   "Emissor (tipo)",
  "emissor.no":     "Emissor (nº)",
  "emissor.uf":     "Emissor (UF)",
  parecer_medico:   "Parecer médico",
  no_bo:            "Número do BO",
  arquivo_url:      "Atestado médico",
};

type Lookups = {
  empresas: { id: string; nome: string }[];
  unidades: { id: string; nome: string }[];
};

type RelacaoVitima = "colaborador" | "terceiro" | "visitante";

const RELACAO_OPTIONS: { value: RelacaoVitima; label: string }[] = [
  { value: "colaborador", label: "Colaborador" },
  { value: "terceiro",    label: "Terceiro" },
  { value: "visitante",   label: "Visitante" },
];

const TIPO_LOCAL_OPTIONS = [
  { value: "proprio",   label: "Estabelecimento Próprio da Empresa" },
  { value: "terceiros", label: "Estabelecimento do Cliente/Terceiros" },
  { value: "via",       label: "Via Pública" },
  { value: "via",       label: "Embarcações" },
] as const;

const EMISSOR_TIPOS = [
  { value: "CRM", label: "CRM" },
  { value: "CRO", label: "CRO" },
];

export function OcorrenciaForm({ lookups }: { lookups: Lookups }) {
  const router = useRouter();
  const form = useForm<OcorrenciaInput>({
    resolver: zodResolver(OcorrenciaInputSchema),
    mode: "onBlur",
    defaultValues: {
      atendimento: false,
      afastamento: false,
      internacao: false,
      morte: false,
      bo: false,
    },
  });
  const [arquivoUrl, setArquivoUrl] = React.useState<string | undefined>(undefined);
  const [haVitimaIncidente, setHaVitimaIncidente] = React.useState(false);

  const empresaId      = form.watch("empresa_id");
  const unidadeId      = form.watch("unidade_id");
  const tipo           = form.watch("tipo");
  const relacaoVitima  = form.watch("relacao_vitima");
  const colaboradorNome = form.watch("colaborador_nome");
  const tipoLocal      = form.watch("tipo_local");
  const atendimento    = form.watch("atendimento") ?? false;
  const afastamento    = form.watch("afastamento") ?? false;
  const internacao     = form.watch("internacao") ?? false;
  const morte          = form.watch("morte") ?? false;
  const bo             = form.watch("bo") ?? false;
  const emissorTipo    = form.watch("emissor.tipo");

  const isAmbiental = tipo === "ambiental";
  const isIncidente = tipo === "incidente";
  const haVitima = isAmbiental ? false : isIncidente ? haVitimaIncidente : !!tipo;

  const empresaItems = React.useMemo(
    () => lookups.empresas.map((e) => ({ value: e.id, label: e.nome })),
    [lookups.empresas],
  );
  const unidadeItems = React.useMemo(
    () => lookups.unidades.map((u) => ({ value: u.id, label: u.nome })),
    [lookups.unidades],
  );
  const tipoItems = React.useMemo(
    () => (TIPOS as string[]).map((t) => ({ value: t, label: ocorrenciaTipoLabel(t) })),
    [],
  );

  async function onSubmit(values: OcorrenciaInput) {
    if (values.atendimento && values.afastamento && !arquivoUrl) {
      form.setError("arquivo_url", {
        type: "required",
        message: "Atestado obrigatório quando há afastamento médico.",
      });
      toast.error("Anexe o atestado antes de enviar.");
      return;
    }
    const payload: OcorrenciaInput = {
      ...values,
      arquivo_url: arquivoUrl,
      // Limpa campos dependentes para nunca persistir lixo após o usuário
      // mudar de ideia (ex.: marcou atendimento, preencheu CID, depois desmarcou).
      ...(isAmbiental || !haVitima
        ? {
            cpf: undefined,
            colaborador_nome: undefined,
            colaborador_setor: undefined,
            colaborador_cargo: undefined,
            colaborador_codigo_soc: undefined,
            relacao_vitima: undefined,
            dut: undefined,
          }
        : {}),
      ...(!values.relacao_vitima ? { dut: undefined } : {}),
      ...(values.tipo_local !== "terceiros" ? { cnpj_local: undefined } : {}),
      ...(!values.atendimento
        ? {
            data_atendimento: undefined,
            hora_atendimento: undefined,
            afastamento: false,
            duracao_afastamento: undefined,
            internacao: false,
            cid: undefined,
            emissor: undefined,
            parecer_medico: undefined,
            morte: false,
            bo: false,
            no_bo: undefined,
          }
        : {}),
      ...(values.atendimento && !values.afastamento ? { duracao_afastamento: undefined } : {}),
      ...(values.atendimento && !values.bo ? { no_bo: undefined } : {}),
    };

    try {
      const r = await fetch("/api/public/ocorrencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error((j as { error?: string }).error ?? "Erro");
        return;
      }
      toast.success("Ocorrência registrada.");
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

      {/* ─── Identificação ─── */}
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
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unidade_id">Unidade</Label>
        <Select
          items={unidadeItems}
          value={unidadeId ?? ""}
          onValueChange={(v) => form.setValue("unidade_id", v as string, { shouldValidate: true })}
        >
          <SelectTrigger id="unidade_id" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {unidadeItems.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo">Tipo de ocorrência</Label>
        <Select
          items={tipoItems}
          value={tipo ?? ""}
          onValueChange={(v) => form.setValue("tipo", v as string, { shouldValidate: true })}
        >
          <SelectTrigger id="tipo" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {tipoItems.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data_ocorrencia">Data do evento</Label>
          <Input id="data_ocorrencia" type="date" {...form.register("data_ocorrencia")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hora_ocorrencia">Hora do evento</Label>
          <Input id="hora_ocorrencia" type="time" {...form.register("hora_ocorrencia")} />
        </div>
      </div>

      {/* ─── Vítima ─── */}
      {tipo && isIncidente && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={haVitimaIncidente}
            onCheckedChange={(v) => {
              const next = Boolean(v);
              setHaVitimaIncidente(next);
              if (!next) {
                form.setValue("relacao_vitima", undefined, { shouldDirty: true });
                form.setValue("cpf", "", { shouldDirty: true });
              }
            }}
          />
          Houve vítima
        </label>
      )}

      {haVitima && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="relacao_vitima">Relação da vítima</Label>
            <Select
              items={RELACAO_OPTIONS}
              value={relacaoVitima ?? ""}
              onValueChange={(v) => {
                form.setValue("relacao_vitima", v as RelacaoVitima, { shouldValidate: true });
                form.setValue("cpf", "", { shouldDirty: true });
                form.setValue("colaborador_nome", "", { shouldDirty: true });
              }}
            >
              <SelectTrigger id="relacao_vitima" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {RELACAO_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {relacaoVitima === "colaborador" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>CPF da vítima</Label>
                <CpfLookup
                  empresaId={empresaId}
                  resolveUnidade={false}
                  onResolved={(data) => {
                    form.setValue("cpf", data.cpf);
                    form.setValue("colaborador_nome", data.nome, { shouldValidate: true });
                    form.setValue("colaborador_setor", data.setor);
                    form.setValue("colaborador_cargo", data.cargo);
                    form.setValue("colaborador_codigo_soc", data.codigo_soc);
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
            </>
          )}

          {(relacaoVitima === "terceiro" || relacaoVitima === "visitante") && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cpf">CPF da vítima (opcional)</Label>
              <Input
                id="cpf"
                inputMode="numeric"
                maxLength={11}
                placeholder="11 dígitos"
                className="font-mono"
                {...form.register("cpf")}
              />
            </div>
          )}

          {relacaoVitima && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dut">Último dia trabalhado (DUT)</Label>
              <Input id="dut" type="date" {...form.register("dut")} />
            </div>
          )}
        </>
      )}

      {/* ─── Descrição e local ─── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="descricao">Descrição da ocorrência</Label>
        <Textarea
          id="descricao"
          rows={4}
          {...form.register("descricao")}
          placeholder="O que aconteceu, quando e onde…"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo_local">Tipo do local</Label>
        <Select
          items={TIPO_LOCAL_OPTIONS as unknown as { value: string; label: string }[]}
          value={tipoLocal ?? ""}
          onValueChange={(v) =>
            form.setValue("tipo_local", v as "proprio" | "terceiros" | "via", { shouldValidate: true })
          }
        >
          <SelectTrigger id="tipo_local" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {TIPO_LOCAL_OPTIONS.map((opt, i) => (
              <SelectItem key={`${opt.value}-${i}`} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tipoLocal === "terceiros" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cnpj_local">CNPJ do local (cliente/terceiro)</Label>
          <Input
            id="cnpj_local"
            inputMode="numeric"
            maxLength={14}
            placeholder="14 dígitos"
            className="font-mono"
            {...form.register("cnpj_local")}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="texto_local">Descrição do local</Label>
        <Textarea id="texto_local" rows={3} {...form.register("texto_local")} placeholder="Detalhes do local…" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email_remetente">Email do solicitante</Label>
        <Input id="email_remetente" type="email" {...form.register("email_remetente")} />
      </div>

      {/* ─── Atendimento médico (somente quando não-ambiental) ─── */}
      {!isAmbiental && tipo && (
        <fieldset className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] p-3">
          <legend className="px-1 text-sm font-medium">Atendimento médico</legend>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={atendimento}
              onCheckedChange={(v) =>
                form.setValue("atendimento", Boolean(v), { shouldDirty: true })
              }
            />
            Houve atendimento médico
          </label>

          {atendimento && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="data_atendimento">Data do atendimento</Label>
                  <Input id="data_atendimento" type="date" {...form.register("data_atendimento")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hora_atendimento">Hora do atendimento</Label>
                  <Input id="hora_atendimento" type="time" {...form.register("hora_atendimento")} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={afastamento}
                  onCheckedChange={(v) =>
                    form.setValue("afastamento", Boolean(v), { shouldDirty: true })
                  }
                />
                Gerou afastamento médico
              </label>

              {afastamento && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="duracao_afastamento">Duração do afastamento (dias)</Label>
                  <Input
                    id="duracao_afastamento"
                    type="number"
                    min={1}
                    {...form.register("duracao_afastamento", { valueAsNumber: true })}
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={internacao}
                  onCheckedChange={(v) =>
                    form.setValue("internacao", Boolean(v), { shouldDirty: true })
                  }
                />
                Gerou internação hospitalar
              </label>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cid">CID</Label>
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="emissor_tipo">Emissor</Label>
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
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
                  <Input
                    id="emissor_uf"
                    maxLength={2}
                    className="uppercase"
                    {...form.register("emissor.uf")}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="parecer_medico">Parecer médico</Label>
                <Textarea id="parecer_medico" rows={3} {...form.register("parecer_medico")} />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={morte}
                  onCheckedChange={(v) =>
                    form.setValue("morte", Boolean(v), { shouldDirty: true })
                  }
                />
                Vítima foi a óbito
              </label>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={bo}
                  onCheckedChange={(v) =>
                    form.setValue("bo", Boolean(v), { shouldDirty: true })
                  }
                />
                Houve registro policial
              </label>

              {bo && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="no_bo">Número do BO</Label>
                  <Input id="no_bo" {...form.register("no_bo")} />
                </div>
              )}

              {afastamento && (
                <div className="flex flex-col gap-1.5">
                  <Label>Atestado médico *</Label>
                  <FileUpload
                    onUploaded={(url) => {
                      setArquivoUrl(url);
                      form.clearErrors("arquivo_url");
                    }}
                  />
                  {arquivoUrl && (
                    <p className="text-xs text-[var(--color-fg-muted)]">Atestado carregado.</p>
                  )}
                </div>
              )}
            </>
          )}
        </fieldset>
      )}

      <Button type="submit" disabled={form.formState.isSubmitting}>
        Enviar ocorrência
      </Button>
    </form>
  );
}
