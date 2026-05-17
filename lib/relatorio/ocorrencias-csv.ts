import { fmtDate } from "@/lib/fmt-date";

export type OcorrenciaReportRow = {
  serial_id: number;
  cpf: string | null;
  colaborador_nome: string | null;
  colaborador_cargo: string | null;
  colaborador_setor: string | null;
  tipo: string;
  data_ocorrencia: string;
  hora_ocorrencia: string | null;
  situacao: string;
  afastamento: boolean;
  atendimento: boolean;
  bo: boolean;
  internacao: boolean;
  morte: boolean;
  cid: string | null;
  empresas: { nome: string } | null;
  unidades: { nome: string } | null;
};

export const OCORRENCIA_HEADERS = [
  "ID",
  "CPF",
  "Colaborador",
  "Cargo",
  "Setor",
  "Empresa",
  "Unidade",
  "Tipo",
  "Data ocorrência",
  "Hora ocorrência",
  "Situação",
  "Afastamento",
  "Atendimento",
  "BO",
  "Internação",
  "Morte",
  "CID",
];

export function toOcorrenciaCsvRows(rows: OcorrenciaReportRow[]): string[][] {
  return rows.map((r) => [
    String(r.serial_id),
    r.cpf ?? "",
    r.colaborador_nome ?? "",
    r.colaborador_cargo ?? "",
    r.colaborador_setor ?? "",
    r.empresas?.nome ?? "",
    r.unidades?.nome ?? "",
    r.tipo,
    fmtDate(r.data_ocorrencia),
    r.hora_ocorrencia ?? "",
    r.situacao,
    r.afastamento ? "Sim" : "Não",
    r.atendimento ? "Sim" : "Não",
    r.bo ? "Sim" : "Não",
    r.internacao ? "Sim" : "Não",
    r.morte ? "Sim" : "Não",
    r.cid ?? "",
  ]);
}
