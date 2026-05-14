"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { FileUpload } from "./file-upload";
import { CpfLookup } from "./cpf-lookup";

type Lookups = {
  empresas: { id: string; nome: string }[];
  unidades: { id: string; nome: string }[];
  tipos:    { id: string; codigo: string; rotulo: string }[];
};

export function AfastamentoForm({
  lookups,
  initial,
}: {
  lookups: Lookups;
  initial?: Partial<AfastamentoInput> & { token?: string };
}) {
  const router = useRouter();
  const form = useForm<AfastamentoInput>({
    resolver: zodResolver(AfastamentoInputSchema),
    defaultValues: initial as AfastamentoInput | undefined,
  });
  const [arquivoUrl, setArquivoUrl] = React.useState<string | undefined>(initial?.arquivo_url);

  async function onSubmit(values: AfastamentoInput) {
    const payload = { ...values, arquivo_url: arquivoUrl };
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label>CPF</Label>
        <CpfLookup
          onResolved={(data) => {
            form.setValue("cpf", data.cpf);
            form.setValue("colaborador_nome", data.nome);
            form.setValue("colaborador_setor", data.setor);
            form.setValue("colaborador_cargo", data.cargo);
            form.setValue("colaborador_codigo_soc", data.codigo_soc);
            if (data.empresa_id) form.setValue("empresa_id", data.empresa_id);
            if (data.unidade_id) form.setValue("unidade_id", data.unidade_id);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="colaborador_nome">Nome do colaborador</Label>
        <Input id="colaborador_nome" {...form.register("colaborador_nome")} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="empresa_id">Empresa</Label>
          <Select
            value={form.watch("empresa_id") ?? ""}
            onValueChange={(v) => form.setValue("empresa_id", v as string)}
          >
            <SelectTrigger id="empresa_id" className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {lookups.empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unidade_id">Unidade</Label>
          <Select
            value={form.watch("unidade_id") ?? ""}
            onValueChange={(v) => form.setValue("unidade_id", v as string)}
          >
            <SelectTrigger id="unidade_id" className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {lookups.unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo_id">Tipo de afastamento</Label>
        <Select
          value={form.watch("tipo_id") ?? ""}
          onValueChange={(v) => form.setValue("tipo_id", v as string)}
        >
          <SelectTrigger id="tipo_id" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {lookups.tipos.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email_remetente">Email para retorno</Label>
        <Input id="email_remetente" type="email" {...form.register("email_remetente")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Anexo</Label>
        <FileUpload onUploaded={setArquivoUrl} />
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
