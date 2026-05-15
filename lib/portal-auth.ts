import type { User } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";

export type ColaboradorSession =
  | { status: "unauthenticated" }
  | { status: "no_profile"; user: User }
  | { status: "ok"; user: User; cpf: string };

export async function requireColaborador(): Promise<ColaboradorSession> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "unauthenticated" };

  const { data } = await supabase
    .from("colaboradores")
    .select("cpf")
    .eq("id", user.id)
    .single();

  if (!data) return { status: "no_profile", user };
  return { status: "ok", user, cpf: data.cpf };
}
