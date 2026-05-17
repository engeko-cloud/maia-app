import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function requireEquipe(codigo: "oh" | "safety") {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: usuario } = await supabase
    .from("usuarios").select("administrador").eq("id", user.id).single();
  if (usuario?.administrador) return user;

  const { data: m } = await supabase
    .from("equipe_usuarios").select("equipes!inner(codigo)").eq("usuario_id", user.id);
  const hasIt = (m ?? []).some((row: any) => row.equipes?.codigo === codigo);
  if (!hasIt) redirect("/app/painel");
  return user;
}
