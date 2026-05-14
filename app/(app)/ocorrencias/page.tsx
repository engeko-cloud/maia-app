import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function OcorrenciasPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("ocorrencias")
    .select(`id, tipo, situacao, data_ocorrencia, empresas!inner(nome)`)
    .order("criado_em", { ascending: false }).limit(200);
  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Ocorrências</h1>
      <ul className="border rounded divide-y">
        {(data ?? []).map((o: any) => (
          <li key={o.id} className="p-3">
            <Link href={`/ocorrencias/${o.id}`} className="text-primary underline">{o.tipo}</Link>
            <span className="ml-2 text-xs text-muted-foreground">{o.empresas?.nome} · {o.situacao}</span>
          </li>
        ))}
        {!data?.length && <li className="p-6 text-muted-foreground">Nenhuma ocorrência.</li>}
      </ul>
    </main>
  );
}
