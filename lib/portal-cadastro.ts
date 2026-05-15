import { getSupabaseAdmin } from "@/lib/supabase/admin";

const CPF_REGEX = /^\d{11}$/;

export async function processCadastro(
  userId: string,
  cpf: string,
): Promise<{ status: 200 | 400 | 422 | 500; error?: string }> {
  if (!CPF_REGEX.test(cpf)) {
    return { status: 400, error: "CPF deve ter 11 dígitos numéricos" };
  }

  const admin = getSupabaseAdmin();

  const { count, error: countError } = await admin
    .from("afastamentos")
    .select("id", { count: "exact", head: true })
    .eq("cpf", cpf);

  if (countError) return { status: 500, error: countError.message };
  if (!count) {
    return { status: 422, error: "CPF não encontrado nos nossos registros." };
  }

  const { data: existing, error: existingError } = await admin
    .from("colaboradores")
    .select("id")
    .eq("id", userId)
    .single();

  if (existingError && existingError.code !== "PGRST116") {
    return { status: 500, error: existingError.message };
  }

  if (existing) return { status: 200 };

  const { error } = await admin
    .from("colaboradores")
    .insert({ id: userId, cpf });

  if (error) return { status: 500, error: error.message };
  return { status: 200 };
}
