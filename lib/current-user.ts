import { cache } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Me } from "@/lib/permissions";

export const getCurrentUser = cache(async (): Promise<Me | null> => {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("usuarios")
    .select("id, administrador, equipe_usuarios(equipes(codigo))")
    .eq("id", user.id)
    .single();

  if (!data) return null;

  const equipes = ((data.equipe_usuarios ?? []) as Array<{ equipes: { codigo: string } | null }>)
    .map((eu) => eu.equipes?.codigo)
    .filter((c): c is string => Boolean(c));

  return {
    id: user.id,
    administrador: data.administrador ?? false,
    equipes,
  };
});
