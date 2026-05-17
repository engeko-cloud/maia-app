export type TipoGrupo = "medico" | "declaracao_hora" | "declaracao_fixa" | "outro";

const MEDICAL_CODIGOS = new Set(["doenca", "acidente", "prev_31", "prev_91"]);
const DECLARACAO_HORA_CODIGOS = new Set([
  "consulta_medica",
  "realizacao_exames",
  "audiencia_juridica",
]);
// Duração fixa em dias por código de declaração.
const DECLARACAO_FIXA_DURACAO: Record<string, number> = {
  doacao_sangue: 1,
  obito: 1,
  casamento: 3,
  paternidade: 5,
  maternidade: 120,
};

export function tipoGrupo(codigo: string | undefined | null): TipoGrupo {
  if (!codigo) return "outro";
  if (MEDICAL_CODIGOS.has(codigo)) return "medico";
  if (DECLARACAO_HORA_CODIGOS.has(codigo)) return "declaracao_hora";
  if (codigo in DECLARACAO_FIXA_DURACAO) return "declaracao_fixa";
  return "outro";
}

export function duracaoFixa(codigo: string | undefined | null): number | undefined {
  if (!codigo) return undefined;
  return DECLARACAO_FIXA_DURACAO[codigo];
}

// Mesmo dia (data_inicio + duracao 1) ⇒ data_fim = data_inicio.
export function addDays(isoDate: string, days: number): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(dt.getTime())) return undefined;
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function calcDataFim(dataInicio: string, duracao: number): string | undefined {
  const dias = Math.max(0, Math.floor(duracao) - 1);
  return addDays(dataInicio, dias);
}
