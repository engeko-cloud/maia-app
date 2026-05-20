import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/admin-auth";
import { writeEvento } from "@/lib/eventos";
import { pushToFluig } from "@/lib/fluig";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = getSupabaseAdmin();

  const { data: full, error: loadErr } = await admin
    .from("afastamentos")
    .select(`id, situacao, cpf, colaborador_nome, colaborador_codigo_soc,
             data_inicio, data_fim, duracao, cid, arquivo_url, tipo_id,
             hora_inicio, hora_fim, emissor,
             empresas!inner(nome, codigo_fluig),
             unidades!inner(nome),
             afastamento_tipos!inner(codigo, rotulo, requer_aprovacao)`)
    .eq("id", id)
    .single();
  if (loadErr || !full) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (full.situacao !== "finalizado") {
    return NextResponse.json(
      { error: "Apenas afastamentos finalizados podem ser reenviados ao Fluig." },
      { status: 409 },
    );
  }
  if (!(full.afastamento_tipos as any).requer_aprovacao) {
    return NextResponse.json(
      { error: "Este tipo de afastamento não exige envio ao Fluig." },
      { status: 409 },
    );
  }

  try {
    const result = await pushToFluig({
      afastamento_id:         id,
      tipo_codigo:            (full.afastamento_tipos as any).codigo,
      cpf:                    full.cpf,
      colaborador_nome:       full.colaborador_nome ?? "",
      colaborador_codigo_soc: full.colaborador_codigo_soc,
      empresa_codigo_fluig:   (full.empresas as any).codigo_fluig ?? "",
      data_inicio:    full.data_inicio,
      data_fim:       full.data_fim,
      duracao:        full.duracao,
      cid:            full.cid,
      cid_descricao:  full.cid,
      hora_inicio:    full.hora_inicio ?? null,
      hora_fim:       full.hora_fim ?? null,
      emissor:        full.emissor as { tipo: string; nome: string; numero: string; uf: string } | null,
      unidade_nome:   (full.unidades as any).nome ?? "",
      arquivo_url:    full.arquivo_url,
    });
    if (result?.ok) {
      await admin.from("afastamentos")
        .update({ enviado_fluig_em: new Date().toISOString() })
        .eq("id", id);
      await writeEvento(admin, {
        tipoEntidade: "afastamento", entidadeId: id,
        evento: "fluig_enviado", autorId: user.id,
        dados: { response: result.response, retry: true },
      });
      return NextResponse.json({ ok: true, response: result.response });
    }
    if (result?.skipped) {
      return NextResponse.json({ ok: false, skipped: true, message: "Envio ignorado pelo backend." });
    }
    await writeEvento(admin, {
      tipoEntidade: "afastamento", entidadeId: id,
      evento: "fluig_erro", autorId: user.id, dados: { ...result, retry: true },
    });
    return NextResponse.json(
      { ok: false, error: result?.error?.message ?? "Falha no envio." },
      { status: 502 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await writeEvento(admin, {
      tipoEntidade: "afastamento", entidadeId: id,
      evento: "fluig_erro", autorId: user.id, dados: { error: message, retry: true },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
