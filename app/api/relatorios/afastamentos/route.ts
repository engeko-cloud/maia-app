import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toCsvFile } from "@/lib/relatorio/csv";
import {
  toAfastamentoCsvRows,
  AFASTAMENTO_HEADERS,
  type AfastamentoReportRow,
} from "@/lib/relatorio/afastamentos-csv";
import { relatorioPronto } from "@/emails/relatorio-pronto";

export async function POST(req: NextRequest) {
  const user = await requireSafetyOrAdmin();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    empresa_id?: string;
    empresa_nome?: string;
    unidade_id?: string;
    unidade_nome?: string;
    cpf?: string;
    data_de?: string;
    data_ate?: string;
  };

  const admin = getSupabaseAdmin();
  let q = admin
    .from("afastamentos")
    .select(
      "serial_id, cpf, colaborador_nome, colaborador_cargo, colaborador_setor, data_inicio, data_fim, duracao, situacao, acidente, inss, internacao, cid, afastamento_tipos!inner(rotulo), empresas!inner(nome), unidades!inner(nome)",
    )
    .order("data_inicio", { ascending: false });

  if (body.empresa_id) q = q.eq("empresa_id", body.empresa_id);
  if (body.unidade_id) q = q.eq("unidade_id", body.unidade_id);
  if (body.cpf)        q = q.eq("cpf", body.cpf);
  if (body.data_de)    q = q.gte("data_inicio", body.data_de);
  if (body.data_ate)   q = q.lte("data_inicio", body.data_ate);

  const { data, error } = await q.returns<AfastamentoReportRow[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const csv = toCsvFile(AFASTAMENTO_HEADERS, toAfastamentoCsvRows(rows));

  const parts: string[] = [];
  if (body.empresa_nome) parts.push(`Empresa: ${body.empresa_nome}`);
  if (body.unidade_nome) parts.push(`Unidade: ${body.unidade_nome}`);
  if (body.cpf)          parts.push(`CPF: ${body.cpf}`);
  if (body.data_de)      parts.push(`De: ${body.data_de}`);
  if (body.data_ate)     parts.push(`Até: ${body.data_ate}`);

  const html = relatorioPronto({
    r: {
      domain: "Afastamentos",
      filterSummary: parts.join(", "),
      rowCount: rows.length,
    },
  });

  if (!user.email) return NextResponse.json({ error: "Conta sem e-mail configurado." }, { status: 422 });

  const today = new Date().toISOString().slice(0, 10);
  const resend = new Resend(process.env.RESEND_TEST_API_KEY!);
  const { error: mailError } = await resend.emails.send({
    from: "Maia <maia@fapptory.me>",
    to: user.email!,
    subject: `Relatório de afastamentos — ${today}`,
    html,
    attachments: [
      {
        filename: `afastamentos-${today}.csv`,
        content: Buffer.from("﻿" + csv, "utf-8"),
      },
    ],
  });

  if (mailError) return NextResponse.json({ error: mailError.message }, { status: 500 });
  return NextResponse.json({ message: "Relatório enviado para o seu e-mail." });
}
