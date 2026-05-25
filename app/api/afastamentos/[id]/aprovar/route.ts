import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeEvento } from "@/lib/eventos";
import { canTransition } from "@/lib/afastamento-state";
import { pushToFluig } from "@/lib/fluig";
import { sendMail } from "@/lib/mail/send";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  // Verifica autenticação do usuário
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Verifica permissão: somente admin ou membro da equipe oh pode aprovar
  const { data: usuario } = await supabase.from("usuarios").select("administrador").eq("id", user.id).single();
  const { data: m } = await supabase.from("equipe_usuarios").select("equipes!inner(codigo)").eq("usuario_id", user.id);
  const isOh = (m ?? []).some((r: any) => r.equipes?.codigo === "oh");
  if (!usuario?.administrador && !isOh) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Cliente admin para bypassar RLS — busca todos os campos necessários para o Fluig
  const admin = getSupabaseAdmin();
  const { data: full, error: fullErr } = await admin
    .from("afastamentos")
    .select(`id, serial_id, token_edicao, situacao, cpf, colaborador_nome, colaborador_codigo_soc,
             data_inicio, data_fim, duracao, cid, arquivo_url, tipo_id, email_remetente,
             hora_inicio, hora_fim, emissor,
             empresas!inner(nome, codigo_fluig),
             unidades!inner(nome),
             afastamento_tipos!inner(codigo, rotulo, requer_aprovacao)`)
    .eq("id", id)
    .single();
  if (fullErr || !full) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Valida transição via máquina de estados antes de qualquer escrita
  if (!canTransition(full.situacao as any, "finalizado")) {
    return NextResponse.json({ error: "invalid_transition", from: full.situacao }, { status: 409 });
  }

  // Atualiza situação para finalizado — enviado_fluig_em será definido assincronamente se o envio ao Fluig tiver sucesso
  const { error: upErr } = await admin
    .from("afastamentos")
    .update({
      situacao: "finalizado",
      decidido_por: user.id,
      decidido_em: new Date().toISOString(),
      enviado_fluig_em: null,  // set asynchronously if Fluig succeeds
    })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Registra evento de auditoria de aprovação
  await writeEvento(admin, {
    tipoEntidade: "afastamento", entidadeId: id, evento: "aprovado", autorId: user.id,
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "";
  const emailA = {
    serial_id:        full.serial_id,
    colaborador_nome: full.colaborador_nome,
    cpf:              full.cpf,
    tipo_rotulo:      (full.afastamento_tipos as any).rotulo,
    data_inicio:      full.data_inicio,
    data_fim:         full.data_fim,
    empresa_nome:     (full.empresas as any).nome,
    unidade_nome:     (full.unidades as any).nome,
    situacao:         "finalizado",
    cid:              full.cid,
    status_url:       `${baseUrl}/afastamentos/status/${full.token_edicao}`,
  };

  if (full.email_remetente) {
    try {
      await sendMail({ template: "afastamento-approved", to: full.email_remetente, data: { a: emailA } });
      await writeEvento(admin, { tipoEntidade: "afastamento", entidadeId: id,
        evento: "email_enviado", autorId: user.id, dados: { template: "afastamento-approved" } });
    } catch (err: any) {
      await writeEvento(admin, { tipoEntidade: "afastamento", entidadeId: id,
        evento: "email_enviado", autorId: user.id, dados: { template: "afastamento-approved", error: err.message } });
    }
  }

  const { data: cfg } = await admin.from("configuracoes").select("email_folha").eq("id", 1).single();
  if (cfg?.email_folha) {
    try {
      await sendMail({ template: "folha-approved-medical", to: cfg.email_folha, data: { a: emailA } });
      await writeEvento(admin, { tipoEntidade: "afastamento", entidadeId: id,
        evento: "email_enviado", autorId: user.id, dados: { template: "folha-approved-medical" } });
    } catch (err: any) {
      await writeEvento(admin, { tipoEntidade: "afastamento", entidadeId: id,
        evento: "email_enviado", autorId: user.id, dados: { template: "folha-approved-medical", error: err.message } });
    }
  }

  // Fire-and-forget: envia para o Fluig sem bloquear a resposta ao cliente
  if ((full.afastamento_tipos as any).requer_aprovacao) {
    void (async () => {
      try {
        const result = await pushToFluig({
          afastamento_id:         String(full.serial_id),
          tipo_codigo:            (full.afastamento_tipos as any).codigo,
          cpf:                    full.cpf,
          colaborador_nome:       full.colaborador_nome ?? "",
          colaborador_codigo_soc: full.colaborador_codigo_soc,
          empresa_codigo_fluig:   (full.empresas as any).codigo_fluig ?? "",
          data_inicio:    full.data_inicio,
          data_fim:       full.data_fim,
          duracao:        full.duracao,
          cid:            full.cid,
          cid_descricao:  full.cid,  // no cid_list table; pass code as description
          hora_inicio:    full.hora_inicio ?? null,
          hora_fim:       full.hora_fim ?? null,
          emissor:        full.emissor as { tipo: string; nome: string; numero: string; uf: string } | null,
          unidade_nome:   (full.unidades as any).nome ?? "",
          arquivo_url:    full.arquivo_url,
        });
        if (result?.ok) {
          await admin.from("afastamentos").update({ enviado_fluig_em: new Date().toISOString() }).eq("id", id);
          await writeEvento(admin, {
            tipoEntidade: "afastamento", entidadeId: id,
            evento: "fluig_enviado", autorId: user.id, dados: { response: result.response },
          });
        } else if (!result?.skipped) {
          await writeEvento(admin, {
            tipoEntidade: "afastamento", entidadeId: id,
            evento: "fluig_erro", autorId: user.id, dados: result,
          });
        }
      } catch (err: unknown) {
        await writeEvento(admin, {
          tipoEntidade: "afastamento", entidadeId: id,
          evento: "fluig_erro", autorId: user.id, dados: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    })();
  }

  return NextResponse.json({ ok: true });
}
