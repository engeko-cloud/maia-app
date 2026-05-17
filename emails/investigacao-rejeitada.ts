import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type InvestigacaoRejeitadaEmail = {
  serial_id?: number | null;
  tipo: string;
  data_ocorrencia: string;
  empresa_nome: string;
  unidade_nome: string;
  motivo: string;
  edit_url: string;
};

export function investigacaoRejeitada(data: { o: InvestigacaoRejeitadaEmail }): string {
  const { o } = data;
  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "";
  const body = `
    <p style="margin:16px 0;">A investigação <strong>${escapeHtml(idLabel)}</strong> precisa de ajustes antes de ser aprovada.</p>
    <div style="background:${EMAIL_COLORS.dangerBg};padding:12px;border-radius:8px;margin-bottom:12px;">
      <p style="margin:0;font-size:12px;color:${EMAIL_COLORS.muted};text-transform:uppercase;letter-spacing:0.04em;">Motivo da rejeição</p>
      <p style="margin:8px 0 0;white-space:pre-wrap;">${escapeHtml(o.motivo)}</p>
    </div>
    ${recordTable([
      { label: "Identificador", value: idLabel || "—" },
      { label: "Tipo",          value: o.tipo },
      { label: "Data",          value: o.data_ocorrencia },
      { label: "Empresa",       value: o.empresa_nome },
      { label: "Unidade",       value: o.unidade_nome },
    ])}
    <div style="margin-top:16px;">
      <a href="${escapeHtml(o.edit_url)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Editar investigação</a>
    </div>
  `;
  return layout(`Investigação ${idLabel} precisa de ajustes`, body);
}
