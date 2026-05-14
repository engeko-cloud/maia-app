import { layout } from "./_layout";
import { recordTable } from "./_record-table";
import type { AfastamentoEmail } from "./afastamento-receipt";

export function folhaAutoAccept(data: { a: AfastamentoEmail }): string {
  const { a } = data;
  const body = `
    <p style="margin:16px 0;">Um novo registro de afastamento (não-médico) foi recebido e registrado automaticamente.</p>
    ${recordTable([
      { label: "Colaborador", value: `${a.colaborador_nome} (${a.cpf})` },
      { label: "Tipo",        value: a.tipo_rotulo },
      { label: "Período",     value: `${a.data_inicio} → ${a.data_fim ?? "—"}` },
      { label: "Empresa",     value: a.empresa_nome },
      { label: "Unidade",     value: a.unidade_nome },
    ])}
  `;
  return layout("Novo afastamento — registro automático", body);
}
