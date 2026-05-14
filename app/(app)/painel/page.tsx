import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function PainelPage() {
  const supabase = await getSupabaseServer();
  const { count: pendentes } = await supabase
    .from("afastamentos").select("id", { count: "exact", head: true }).eq("situacao", "pendente");
  const { data: recentes } = await supabase
    .from("afastamentos")
    .select("id, colaborador_nome, criado_em, situacao")
    .order("criado_em", { ascending: false }).limit(5);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Painel</h1>
      <Link href="/afastamentos/aprovacoes" className="block border rounded p-4 hover:bg-muted/30">
        <div className="text-3xl font-semibold">{pendentes ?? 0}</div>
        <div className="text-sm text-muted-foreground">Afastamentos pendentes de aprovação</div>
      </Link>
      <section>
        <h2 className="text-sm font-semibold mb-2">Recentes</h2>
        <ul className="divide-y border rounded">
          {(recentes ?? []).map(r => (
            <li key={r.id} className="p-3">
              <Link href={`/afastamentos/${r.id}`} className="text-primary underline">{r.colaborador_nome}</Link>
              <span className="text-xs text-muted-foreground ml-2">{r.situacao}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
