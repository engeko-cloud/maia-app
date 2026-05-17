import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import { EMAIL_COLORS } from "./tokens";
import { escapeHtml } from "./_escape";

export type InvestigacaoEmAprovacaoEmail = {
  serial_id?: number | null;
  ocorrencia_id:   string;
  tipo:            string;
  data_ocorrencia: string;
  empresa_nome:    string;
  unidade_nome:    string;
  causas_count:    number;
  acoes_count:     number;
  participantes_count: number;
  fotos_count:     number;
  base_url:        string;
};

export function investigacaoEmAprovacao(data: { o: InvestigacaoEmAprovacaoEmail }): string {
  const { o } = data;
  const link = `${o.base_url}/ocorrencias/${o.ocorrencia_id}/investigacao`;
  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "";
  const body = `
    <p style="margin:16px 0;">A investigação <strong>${escapeHtml(idLabel)}</strong> foi preenchida e aguarda revisão.</p>
    ${recordTable([
      { label: "Identificador", value: idLabel || "—" },
      { label: "Tipo",      value: o.tipo },
      { label: "Data",      value: o.data_ocorrencia },
      { label: "Empresa",   value: o.empresa_nome },
      { label: "Unidade",   value: o.unidade_nome },
      { label: "Resumo",    value: `${o.causas_count} causas · ${o.acoes_count} ações · ${o.participantes_count} participantes · ${o.fotos_count} fotos` },
    ])}
    <div style="margin-top:16px;">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:${EMAIL_COLORS.primary};color:${EMAIL_COLORS.primaryFg};padding:10px 16px;border-radius:6px;text-decoration:none;">Revisar e decidir</a>
    </div>
  `;
  return layout(`Investigação ${idLabel} pronta para aprovação`, body);
}
