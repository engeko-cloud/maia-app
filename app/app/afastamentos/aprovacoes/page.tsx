import Link from "next/link";
import { requireEquipe } from "@/components/gates/equipe-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AprovacoesPanel, type PendenteRow } from "@/components/afastamentos/aprovacoes-panel";

export default async function AprovacoesPage() {
  await requireEquipe("oh");
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("afastamentos")
    .select("id, colaborador_nome, cpf, data_inicio, data_fim, criado_em, email_remetente, arquivo_url, afastamento_tipos!inner(rotulo)")
    .eq("situacao", "pendente")
    .order("criado_em", { ascending: true })
    .returns<PendenteRow[]>();
  const pendentes = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/painel" className="hover:text-foreground">Painel</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <Link href="/afastamentos" className="hover:text-foreground">Afastamentos</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Aprovações</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Aprovações pendentes</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          {pendentes.length} aguardando revisão
        </p>
      </header>
      <AprovacoesPanel pendentes={pendentes} />
    </div>
  );
}
