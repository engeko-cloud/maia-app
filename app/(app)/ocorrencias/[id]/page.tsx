import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { EventosTimeline } from "@/components/eventos-timeline";

export default async function OcorrenciaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const { data: o } = await supabase.from("ocorrencias")
    .select(`*, empresas!inner(nome), unidades!inner(nome), investigacoes(id, situacao)`)
    .eq("id", id).single();
  if (!o) notFound();
  return (
    <main className="max-w-3xl mx-auto p-6 grid grid-cols-[1fr_240px] gap-6">
      <div>
        <h1 className="text-2xl font-semibold mb-4">Ocorrência</h1>
        <p><strong>Tipo:</strong> {o.tipo}</p>
        <p><strong>Empresa/Unidade:</strong> {(o as any).empresas?.nome} / {(o as any).unidades?.nome}</p>
        <p><strong>Data:</strong> {o.data_ocorrencia}</p>
        <p><strong>Situação:</strong> {o.situacao}</p>
        <p className="mt-4 whitespace-pre-wrap">{o.descricao}</p>
        <div className="mt-6">
          <Link href={`/ocorrencias/${id}/investigacao`} className="text-primary underline">
            {(o as any).investigacoes?.length ? "Ver investigação" : "Iniciar investigação"}
          </Link>
        </div>
      </div>
      <aside>
        <h2 className="text-sm font-semibold mb-2">Histórico</h2>
        <EventosTimeline entityType="ocorrencia" entityId={id} />
      </aside>
    </main>
  );
}
