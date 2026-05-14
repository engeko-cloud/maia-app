import { layout } from "./_layout";
import { recordTable } from "./_record-table";

export type AfastamentoEmail = {
  colaborador_nome: string;
  cpf: string;
  tipo_rotulo: string;
  data_inicio: string;
  data_fim?: string | null;
  empresa_nome: string;
  unidade_nome: string;
  situacao: string;
  cid?: string | null;
};

export function afastamentoReceipt(data: { a: AfastamentoEmail }): string {
  const { a } = data;
  const body = `
    <p style="margin:16px 0;">Olá, seu registro foi recebido. Quando houver atualização, avisaremos por aqui.</p>
    ${recordTable([
      { label: "Colaborador", value: `${a.colaborador_nome} (${a.cpf})` },
      { label: "Tipo",        value: a.tipo_rotulo },
      { label: "Período",     value: `${a.data_inicio} → ${a.data_fim ?? "—"}` },
      { label: "Empresa",     value: a.empresa_nome },
      { label: "Unidade",     value: a.unidade_nome },
      { label: "Situação",    value: a.situacao },
    ])}
  `;
  return layout("Recebemos seu afastamento", body);
}
