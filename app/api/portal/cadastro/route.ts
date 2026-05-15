import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { processCadastro } from "@/lib/portal-cadastro";

const Schema = z.object({ cpf: z.string() });

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const result = await processCadastro(user.id, parsed.data.cpf);
  return NextResponse.json(
    result.error ? { error: result.error } : { ok: true },
    { status: result.status },
  );
}
