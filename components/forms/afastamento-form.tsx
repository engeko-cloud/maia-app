"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AfastamentoInputSchema, type AfastamentoInput } from "@/lib/validation/afastamento";
import { FileUpload } from "./file-upload";

type Lookups = {
  empresas: { id: string; nome: string }[];
  unidades: { id: string; nome: string }[];
  tipos:    { id: string; codigo: string; rotulo: string }[];
};

export function AfastamentoForm({ lookups, initial }: { lookups: Lookups; initial?: Partial<AfastamentoInput> & { token?: string } }) {
  const router = useRouter();
  const form = useForm<AfastamentoInput>({
    resolver: zodResolver(AfastamentoInputSchema),
    defaultValues: initial as AfastamentoInput | undefined,
  });
  const [arquivoUrl, setArquivoUrl] = useState<string | undefined>(initial?.arquivo_url);

  async function onSubmit(values: AfastamentoInput) {
    const payload = { ...values, arquivo_url: arquivoUrl };
    const url = initial?.token
      ? `/api/public/afastamentos/${initial.token}`
      : "/api/public/afastamentos";
    const method = initial?.token ? "PATCH" : "POST";
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!res.ok) { const { error } = await res.json(); toast.error(error ?? "Erro"); return; }
    toast.success("Enviado.");
    router.push("/");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl mx-auto space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Registrar Afastamento</h1>

      <label className="block">
        <span>Empresa</span>
        <select {...form.register("empresa_id")} className="w-full border rounded px-3 py-2">
          <option value="">Selecione</option>
          {lookups.empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </label>

      <label className="block">
        <span>Unidade</span>
        <select {...form.register("unidade_id")} className="w-full border rounded px-3 py-2">
          <option value="">Selecione</option>
          {lookups.unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </label>

      <label className="block">
        <span>Tipo</span>
        <select {...form.register("tipo_id")} className="w-full border rounded px-3 py-2">
          <option value="">Selecione</option>
          {lookups.tipos.map(t => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
        </select>
      </label>

      <label className="block">
        <span>CPF (apenas dígitos)</span>
        <input {...form.register("cpf")} className="w-full border rounded px-3 py-2" />
      </label>

      <label className="block">
        <span>Nome do colaborador</span>
        <input {...form.register("colaborador_nome")} className="w-full border rounded px-3 py-2" />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span>Data início</span>
          <input type="date" {...form.register("data_inicio")} className="w-full border rounded px-3 py-2" />
        </label>
        <label className="block">
          <span>Data fim</span>
          <input type="date" {...form.register("data_fim")} className="w-full border rounded px-3 py-2" />
        </label>
      </div>

      <label className="block">
        <span>Email para retorno</span>
        <input type="email" {...form.register("email_remetente")} className="w-full border rounded px-3 py-2" />
      </label>

      <FileUpload onUploaded={setArquivoUrl} />
      {arquivoUrl && <p className="text-sm text-muted-foreground">Anexo carregado: {arquivoUrl}</p>}

      <button type="submit" className="w-full bg-primary text-primary-foreground rounded px-3 py-2">
        Enviar
      </button>
    </form>
  );
}
