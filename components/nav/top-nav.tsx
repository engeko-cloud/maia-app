import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function TopNav() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: u } = await supabase.from("usuarios").select("nome, administrador").eq("id", user.id).single();

  return (
    <header className="border-b">
      <nav className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link href="/painel" className="font-semibold">MAIA</Link>
        <Link href="/afastamentos" className="text-sm">Afastamentos</Link>
        <Link href="/afastamentos/aprovacoes" className="text-sm">Aprovações</Link>
        <Link href="/ocorrencias" className="text-sm">Ocorrências</Link>
        {u?.administrador && <Link href="/admin" className="text-sm text-primary">Admin</Link>}
        <span className="ml-auto text-sm text-muted-foreground">{u?.nome}</span>
      </nav>
    </header>
  );
}
