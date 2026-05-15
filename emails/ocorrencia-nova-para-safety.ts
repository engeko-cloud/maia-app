import { layout } from "./_layout";
import { recordTable } from "./_record-table";

export type OcorrenciaParaSafetyEmail = {
  ocorrencia_id:   string;
  serial_id?:      number | null;
  tipo:            string;
  data_ocorrencia: string;
  empresa_nome:    string;
  unidade_nome:    string;
  descricao:       string;
  base_url:        string;
};

export function ocorrenciaNovaParaSafety(data: { o: OcorrenciaParaSafetyEmail }): string {
  const { o } = data;
  const link = `${o.base_url}/ocorrencias/${o.ocorrencia_id}/investigacao`;
  const idLabel = o.serial_id != null ? `#${o.serial_id}` : "";
  const body = `
    <p style="margin:16px 0;">Uma nova ocorrência <strong>${idLabel}</strong> foi registrada e a investigação está pendente.</p>
    ${recordTable([
      { label: "Identificador", value: idLabel || "—" },
      { label: "Tipo",      value: o.tipo },
      { label: "Data",      value: o.data_ocorrencia },
      { label: "Empresa",   value: o.empresa_nome },
      { label: "Unidade",   value: o.unidade_nome },
      { label: "Descrição", value: o.descricao },
    ])}
    <p style="margin:24px 0;">
      <a href="${link}" style="background:#1f2937;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">
        Abrir investigação
      </a>
    </p>
  `;
  return layout("Nova ocorrência registrada — investigação pendente", body);
}
