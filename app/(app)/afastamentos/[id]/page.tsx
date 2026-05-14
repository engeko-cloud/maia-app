import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AfastamentoDetail } from "@/components/afastamentos/afastamento-detail";
import { EventosTimeline } from "@/components/eventos-timeline";

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const { data: a } = await supabase
    .from("afastamentos")
    .select(`*, empresas!inner(nome), unidades!inner(nome), afastamento_tipos!inner(rotulo)`)
    .eq("id", id).single();
  if (!a) notFound();
  return (
    <main className="max-w-3xl mx-auto p-6 grid grid-cols-[1fr_240px] gap-6">
      <div>
        <h1 className="text-2xl font-semibold mb-4">Afastamento</h1>
        <AfastamentoDetail a={a as any} />
      </div>
      <aside>
        <h2 className="text-sm font-semibold mb-2">Histórico</h2>
        <EventosTimeline entityType="afastamento" entityId={id} />
      </aside>
    </main>
  );
}
