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
};

export function ocorrenciaReceipt(data: { o: OcorrenciaEmail }): string {
  const { o } = data;
  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "";
  const body = `
    <p style="margin:16px 0;">Sua ocorrência <strong>${escapeHtml(idLabel)}</strong> foi registrada. Caso uma investigação seja iniciada, retornaremos por email.</p>
    ${recordTable([
      { label: "Identificador", value: idLabel || "—" },
      { label: "Tipo",          value: o.tipo },
      { label: "Data",          value: o.data_ocorrencia },
      { label: "Empresa",       value: o.empresa_nome },
      { label: "Unidade",       value: o.unidade_nome },
      { label: "Descrição",     value: o.descricao },
    ])}
    ${o.status_url ? `
    <div style="margin-top:16px;">
      <a href="${escapeHtml(o.status_url)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Acompanhar status</a>
    </div>` : ""}
  `;
  return layout("Recebemos sua ocorrência", body);
}
