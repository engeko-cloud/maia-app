import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type InvestigacaoAprovadaEmail = {
  serial_id?: number | null;
  tipo: string;
  data_ocorrencia: string;
  empresa_nome: string;
  unidade_nome: string;
  decidido_por_nome?: string | null;
  decidido_em: string;
  relatorio_url: string;
};

export function investigacaoAprovada(data: { o: InvestigacaoAprovadaEmail }): string {
  const { o } = data;
  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "";
  const body = `
    <p style="margin:16px 0;">A investigação <strong>${escapeHtml(idLabel)}</strong> foi aprovada${o.decidido_por_nome ? ` por ${escapeHtml(o.decidido_por_nome)}` : ""}.</p>
    ${recordTable([
      { label: "Identificador",  value: idLabel || "—" },
      { label: "Tipo",           value: o.tipo },
      { label: "Data",           value: o.data_ocorrencia },
      { label: "Empresa",        value: o.empresa_nome },
      { label: "Unidade",        value: o.unidade_nome },
      { label: "Aprovada em",    value: new Date(o.decidido_em).toLocaleString("pt-BR") },
    ])}
    <div style="margin-top:16px;">
      <a href="${escapeHtml(o.relatorio_url)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Ver relatório</a>
    </div>
  `;
  return layout(`Investigação ${idLabel} concluída`, body);
}
