import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type AfastamentoEmail = {
  serial_id?: number | null;
  colaborador_nome: string;
  cpf: string;
  tipo_rotulo: string;
  data_inicio: string;
  data_fim?: string | null;
  empresa_nome: string;
  unidade_nome: string;
  situacao: string;
  cid?: string | null;
  status_url?: string;
  mensagem?: string | null;
};

export function afastamentoReceipt(data: { a: AfastamentoEmail }): string {
  const { a } = data;
  const idLabel = a.serial_id != null ? `#${a.serial_id}` : "";
  const body = `
    <p style="margin:16px 0;">Olá, seu registro <strong>${escapeHtml(idLabel)}</strong> foi recebido. Quando houver atualização, avisaremos por aqui.</p>
    ${recordTable([
      { label: "Identificador", value: idLabel || "—" },
      { label: "Colaborador",   value: `${a.colaborador_nome} (${a.cpf})` },
      { label: "Tipo",          value: a.tipo_rotulo },
      { label: "Período",       value: `${a.data_inicio} → ${a.data_fim ?? "—"}` },
      { label: "Empresa",       value: a.empresa_nome },
      { label: "Unidade",       value: a.unidade_nome },
      { label: "Situação",      value: a.situacao },
    ])}
    ${a.status_url ? `
    <div style="margin-top:16px;">
      <a href="${escapeHtml(a.status_url)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Acompanhar status</a>
    </div>` : ""}
  `;
  const subjectId = idLabel ? ` ${idLabel}` : "";
  return layout(`Recebemos seu afastamento${subjectId}`, body);
}
