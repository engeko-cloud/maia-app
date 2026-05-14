import { getSupabaseServer } from "@/lib/supabase/server";
import { AfastamentosTable } from "@/components/tables/afastamentos-table";

export default async function AfastamentosListPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const supabase = await getSupabaseServer();
  let q = supabase.from("afastamentos")
    .select(`id, cpf, colaborador_nome, data_inicio, data_fim, situacao,
             afastamento_tipos!inner(rotulo)`)
    .order("criado_em", { ascending: false }).limit(200);
  if (sp.situacao) q = q.eq("situacao", sp.situacao);
  const { data } = await q;
  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Afastamentos</h1>
      <AfastamentosTable rows={data ?? []} />
    </main>
  );
}
