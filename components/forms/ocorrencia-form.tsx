"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OcorrenciaInputSchema, type OcorrenciaInput } from "@/lib/validation/ocorrencia";
import TIPOS from "@/lib/data/ocorrencia_tipos.json";

export function OcorrenciaForm({ lookups }: { lookups: { empresas: any[]; unidades: any[] } }) {
  const router = useRouter();
  const form = useForm<OcorrenciaInput>({ resolver: zodResolver(OcorrenciaInputSchema) });

  async function onSubmit(values: OcorrenciaInput) {
    const r = await fetch("/api/public/ocorrencias", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
    });
    if (!r.ok) { const j = await r.json(); toast.error(j.error ?? "Erro"); return; }
    toast.success("Ocorrência registrada.");
    router.push("/");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl mx-auto space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Registrar Ocorrência</h1>
      <select {...form.register("empresa_id")} className="w-full border rounded px-3 py-2">
        <option value="">Empresa</option>
        {lookups.empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
      </select>
      <select {...form.register("unidade_id")} className="w-full border rounded px-3 py-2">
        <option value="">Unidade</option>
        {lookups.unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
      </select>
      <select {...form.register("tipo")} className="w-full border rounded px-3 py-2">
        <option value="">Tipo</option>
        {(TIPOS as string[]).map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
      </select>
      <input type="datetime-local" {...form.register("data_ocorrencia")} className="w-full border rounded px-3 py-2" />
      <input type="email" placeholder="Email para retorno" {...form.register("email_remetente")} className="w-full border rounded px-3 py-2" />
      <textarea rows={5} placeholder="Descrição" {...form.register("descricao")} className="w-full border rounded px-3 py-2" />
      <button className="w-full bg-primary text-primary-foreground rounded px-3 py-2">Enviar</button>
    </form>
  );
}
