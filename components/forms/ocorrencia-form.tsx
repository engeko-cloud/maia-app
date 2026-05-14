"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stepper } from "@/components/detail/stepper";
import { FileUpload } from "./file-upload";
import { OcorrenciaInputSchema, type OcorrenciaInput } from "@/lib/validation/ocorrencia";
import { ocorrenciaTipoLabel } from "@/lib/ocorrencia-state";
import TIPOS from "@/lib/data/ocorrencia_tipos.json";

const STEPS = [
  { label: "Identificação" },
  { label: "Detalhes" },
  { label: "Anexos" },
];

const STEP_FIELDS: Array<Array<keyof OcorrenciaInput>> = [
  ["empresa_id", "unidade_id", "tipo"],
  ["data_ocorrencia", "email_remetente", "descricao"],
  [],
];

export function OcorrenciaForm({ lookups }: { lookups: { empresas: { id: string; nome: string }[]; unidades: { id: string; nome: string }[] } }) {
  const router = useRouter();
  const form = useForm<OcorrenciaInput>({ resolver: zodResolver(OcorrenciaInputSchema), mode: "onBlur" });
  const [step, setStep] = React.useState(0);
  const [arquivoUrl, setArquivoUrl] = React.useState<string | undefined>(undefined);

  async function nextStep() {
    const valid = await form.trigger(STEP_FIELDS[step]);
    if (!valid) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function onSubmit(values: OcorrenciaInput) {
    const payload = { ...values, arquivo_url: arquivoUrl };
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="empresa_id">Empresa</Label>
            <Select value={form.watch("empresa_id") ?? ""} onValueChange={(v) => form.setValue("empresa_id", v as string)}>
              <SelectTrigger id="empresa_id" className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {lookups.empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unidade_id">Unidade</Label>
            <Select value={form.watch("unidade_id") ?? ""} onValueChange={(v) => form.setValue("unidade_id", v as string)}>
              <SelectTrigger id="unidade_id" className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {lookups.unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={form.watch("tipo") ?? ""} onValueChange={(v) => form.setValue("tipo", v as string)}>
              <SelectTrigger id="tipo" className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(TIPOS as string[]).map((t) => <SelectItem key={t} value={t}>{ocorrenciaTipoLabel(t)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="data_ocorrencia">Data e hora da ocorrência</Label>
            <Input id="data_ocorrencia" type="datetime-local" {...form.register("data_ocorrencia")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email_remetente">Email para retorno</Label>
            <Input id="email_remetente" type="email" {...form.register("email_remetente")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" rows={6} {...form.register("descricao")} placeholder="O que aconteceu, quando e onde…" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Você pode anexar fotos, vídeos, laudos ou outros documentos. Opcional.
          </p>
          <FileUpload onUploaded={setArquivoUrl} />
          {arquivoUrl && <p className="text-xs text-[var(--color-fg-muted)]">Anexo carregado.</p>}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Anterior
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={nextStep}>
            Próximo
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Enviar ocorrência
          </Button>
        )}
      </div>
    </form>
  );
}
