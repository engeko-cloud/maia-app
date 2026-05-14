import { layout } from "./_layout";
import { recordTable } from "./_record-table";

export type OcorrenciaEmail = {
  tipo: string;
  data_ocorrencia: string;
  empresa_nome: string;
  unidade_nome: string;
  descricao: string;
};

export function ocorrenciaReceipt(data: { o: OcorrenciaEmail }): string {
  const { o } = data;
  const body = `
    <p style="margin:16px 0;">Sua ocorrência foi registrada. Caso uma investigação seja iniciada, retornaremos por email.</p>
    ${recordTable([
      { label: "Tipo",      value: o.tipo },
      { label: "Data",      value: o.data_ocorrencia },
      { label: "Empresa",   value: o.empresa_nome },
      { label: "Unidade",   value: o.unidade_nome },
      { label: "Descrição", value: o.descricao },
    ])}
  `;
  return layout("Recebemos sua ocorrência", body);
}
