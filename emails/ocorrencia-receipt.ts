import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type OcorrenciaEmail = {
  serial_id?: number | null;
  tipo: string;
  data_ocorrencia: string;
  empresa_nome: string;
  unidade_nome: string;
  descricao: string;
  status_url?: string;
  investigacao_url?: string;
};

export function ocorrenciaReceipt(data: { o: OcorrenciaEmail }): string {
  const { o } = data;
  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "";
  const body = `
    <p style="margin:16px 0;">Sua ocorrência <strong>${escapeHtml(idLabel)}</strong> foi registrada. Para iniciar a investigação, use o botão abaixo. Você pode acompanhar o andamento a qualquer momento.</p>
    ${recordTable([
      { label: "Identificador", value: idLabel || "—" },
      { label: "Tipo",          value: o.tipo },
      { label: "Data",          value: o.data_ocorrencia },
      { label: "Empresa",       value: o.empresa_nome },
      { label: "Unidade",       value: o.unidade_nome },
      { label: "Descrição",     value: o.descricao },
    ])}
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
      ${o.investigacao_url ? `
      <a href="${escapeHtml(o.investigacao_url)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Preencher investigação</a>
      ` : ""}
      ${o.status_url ? `
      <a href="${escapeHtml(o.status_url)}" style="display:inline-block;background:transparent;color:${EMAIL_COLORS.primary};border:1px solid ${EMAIL_COLORS.primary};padding:10px 16px;border-radius:6px;text-decoration:none;">Acompanhar status</a>
      ` : ""}
    </div>
  `;
  return layout("Recebemos sua ocorrência", body);
}
