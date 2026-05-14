import { getSupabaseServer } from "@/lib/supabase/server";

export async function requireAdminUser() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: u } = await supabase.from("usuarios").select("administrador").eq("id", user.id).single();
  return u?.administrador ? user : null;
}

export async function requireSafetyOrAdmin() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("usuarios")
    .select("administrador, equipe_usuarios(equipes(codigo))")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  if (profile.administrador) return user;
  const equipeRows = (profile as { equipe_usuarios?: Array<{ equipes: { codigo: string } | null }> }).equipe_usuarios ?? [];
  const inSafety = equipeRows.some((eu) => eu.equipes?.codigo === "safety");
  return inSafety ? user : null;
}
