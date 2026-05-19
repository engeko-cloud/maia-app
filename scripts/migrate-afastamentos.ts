import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// ── Legacy types ──────────────────────────────────────────────────────────────

export interface LegacyAfastamento {
  id: number;
  status: string;
  tipo: string;
  org_id: string | null;
  empresa_id: number;
  unidade_id: number | null;
  setor: string | null;
  cargo: string | null;
  pessoa_id: number | null;
  cpf: string;
  data_inicio: string;
  hora_inicio: string;
  data_fim: string | null;
  hora_fim: string;
  duracao: string | null;
  cid: string;
  arquivo_url: string;
  responsavel: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  criado_em: string;
  emissor: unknown;
  inss: boolean | null;
  medico: boolean | null;
  acidente: boolean | null;
  internacao: boolean | null;
  colaborador: string | null;
}

export interface LookupMaps {
  tipoMap:    Map<string, string>;  // codigo → uuid
  empresaMap: Map<string, string>;  // codigo_fluig → uuid
  unidadeMap: Map<number, string>;  // legacy int id → uuid
  userMap:    Map<string, string>;  // legacy auth uuid → new usuarios uuid
}

interface NewAfastamento {
  serial_id:         number;
  situacao:          string;
  tipo_id:           string;
  empresa_id:        string;
  unidade_id:        string;
  cpf:               string;
  data_inicio:       string;
  data_fim:          string | null;
  hora_inicio:       string | null;
  hora_fim:          string | null;
  duracao:           number | null;
  cid:               string | null;
  arquivo_url:       string | null;
  email_remetente:   string;
  decidido_por:      string | null;
  decidido_em:       string | null;
  criado_em:         string;
  emissor:           unknown;
  inss:              boolean;
  acidente:          boolean;
  internacao:        boolean;
  colaborador_nome:  string | null;
  colaborador_setor: string | null;
  colaborador_cargo: string | null;
  motivo_rejeicao:   null;
  enviado_fluig_em:  null;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function nullIfEmpty(s: string | null | undefined): string | null {
  if (!s || s.trim() === "") return null;
  return s;
}

export function transformRow(
  row: LegacyAfastamento,
  maps: LookupMaps
): NewAfastamento | null {
  const tipoId = maps.tipoMap.get(row.tipo);
  if (!tipoId) {
    console.warn(`[SKIP] id=${row.id}: unknown tipo "${row.tipo}"`);
    return null;
  }

  const empresaId = maps.empresaMap.get(String(row.empresa_id));
  if (!empresaId) {
    console.warn(`[SKIP] id=${row.id}: unknown empresa_id ${row.empresa_id}`);
    return null;
  }

  if (row.unidade_id === null) {
    console.warn(`[SKIP] id=${row.id}: null unidade_id`);
    return null;
  }
  const unidadeId = maps.unidadeMap.get(row.unidade_id);
  if (!unidadeId) {
    console.warn(`[SKIP] id=${row.id}: unknown unidade_id ${row.unidade_id}`);
    return null;
  }

  return {
    serial_id:         row.id,
    situacao:          row.status,
    tipo_id:           tipoId,
    empresa_id:        empresaId,
    unidade_id:        unidadeId,
    cpf:               row.cpf,
    data_inicio:       row.data_inicio,
    data_fim:          row.data_fim ?? null,
    hora_inicio:       nullIfEmpty(row.hora_inicio),
    hora_fim:          nullIfEmpty(row.hora_fim),
    duracao:           row.duracao !== null ? Number(row.duracao) : null,
    cid:               nullIfEmpty(row.cid),
    arquivo_url:       nullIfEmpty(row.arquivo_url),
    email_remetente:   row.responsavel,
    decidido_por:      row.aprovado_por ? (maps.userMap.get(row.aprovado_por) ?? null) : null,
    decidido_em:       row.aprovado_em ?? null,
    criado_em:         row.criado_em,
    emissor:           row.emissor ?? null,
    inss:              row.inss ?? false,
    acidente:          row.acidente ?? false,
    internacao:        row.internacao ?? false,
    colaborador_nome:  nullIfEmpty(row.colaborador),
    colaborador_setor: nullIfEmpty(row.setor),
    colaborador_cargo: nullIfEmpty(row.cargo),
    motivo_rejeicao:   null,
    enviado_fluig_em:  null,
  };
}
