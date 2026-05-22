import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { requireSafetyOrAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toCsvFile } from "@/lib/relatorio/csv";
import {
  toOcorrenciaCsvRows,
  OCORRENCIA_HEADERS,
  type OcorrenciaReportRow,
} from "@/lib/relatorio/ocorrencias-csv";
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
    .from("ocorrencias")
    .select(
      "serial_id, cpf, colaborador_nome, colaborador_cargo, colaborador_setor, tipo, data_ocorrencia, hora_ocorrencia, situacao, afastamento, atendimento, bo, internacao, morte, cid, empresas!inner(nome), unidades!inner(nome)",
    )
    .order("data_ocorrencia", { ascending: false });

  if (body.empresa_id) q = q.eq("empresa_id", body.empresa_id);
  if (body.unidade_id) q = q.eq("unidade_id", body.unidade_id);
  if (body.cpf)        q = q.eq("cpf", body.cpf);
  if (body.data_de)    q = q.gte("data_ocorrencia", body.data_de);
  if (body.data_ate)   q = q.lte("data_ocorrencia", body.data_ate);

  const { data, error } = await q.returns<OcorrenciaReportRow[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const csv = toCsvFile(OCORRENCIA_HEADERS, toOcorrenciaCsvRows(rows));

  const parts: string[] = [];
  if (body.empresa_nome) parts.push(`Empresa: ${body.empresa_nome}`);
  if (body.unidade_nome) parts.push(`Unidade: ${body.unidade_nome}`);
  if (body.cpf)          parts.push(`CPF: ${body.cpf}`);
  if (body.data_de)      parts.push(`De: ${body.data_de}`);
  if (body.data_ate)     parts.push(`Até: ${body.data_ate}`);

  const html = relatorioPronto({
    r: {
      domain: "Ocorrências",
      filterSummary: parts.join(", "),
      rowCount: rows.length,
    },
  });

  if (!user.email) return NextResponse.json({ error: "Conta sem e-mail configurado." }, { status: 422 });

  const today = new Date().toISOString().slice(0, 10);
  const DEV_RECIPIENT = "dev-tests@fapptory.me";
  const isDevOverride = process.env.NODE_ENV !== "production";
  const to = isDevOverride ? DEV_RECIPIENT : user.email!;
  const baseSubject = `Relatório de ocorrências — ${today}`;
  const subject = isDevOverride ? `[DEV → ${user.email}] ${baseSubject}` : baseSubject;
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { error: mailError } = await resend.emails.send({
    from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
    to,
    subject,
    html,
    attachments: [
      {
        filename: `ocorrencias-${today}.csv`,
        content: Buffer.from("﻿" + csv, "utf-8"),
      },
    ],
  });

  if (mailError) return NextResponse.json({ error: mailError.message }, { status: 500 });
  return NextResponse.json({ message: "Relatório enviado para o seu e-mail." });
}
