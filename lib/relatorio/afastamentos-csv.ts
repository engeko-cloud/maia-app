export type AfastamentoReportRow = {
  serial_id: number;
  cpf: string;
  colaborador_nome: string | null;
  colaborador_cargo: string | null;
  colaborador_setor: string | null;
  data_inicio: string;
  data_fim: string | null;
  duracao: number | null;
  situacao: string;
  acidente: boolean;
  inss: boolean;
  internacao: boolean;
  cid: string | null;
  afastamento_tipos: { rotulo: string } | null;
  empresas: { nome: string } | null;
  unidades: { nome: string } | null;
};

export const AFASTAMENTO_HEADERS = [
  "ID",
  "CPF",
  "Colaborador",
  "Cargo",
  "Setor",
  "Empresa",
  "Unidade",
  "Tipo",
  "Data início",
  "Data fim",
  "Duração (dias)",
  "Situação",
  "Acidente",
  "INSS",
  "Internação",
  "CID",
];

export function toAfastamentoCsvRows(rows: AfastamentoReportRow[]): string[][] {
  return rows.map((r) => [
    String(r.serial_id),
    r.cpf,
    r.colaborador_nome ?? "",
    r.colaborador_cargo ?? "",
    r.colaborador_setor ?? "",
    r.empresas?.nome ?? "",
    r.unidades?.nome ?? "",
    r.afastamento_tipos?.rotulo ?? "",
    r.data_inicio,
    r.data_fim ?? "",
    r.duracao != null ? String(r.duracao) : "",
    r.situacao,
    r.acidente ? "Sim" : "Não",
    r.inss ? "Sim" : "Não",
    r.internacao ? "Sim" : "Não",
    r.cid ?? "",
  ]);
}
