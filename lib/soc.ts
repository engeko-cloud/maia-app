/**
 * Direct SOC (TOTVS) integration via WebSoc/exportadados.
 *
 * The endpoint returns JSON encoded in ISO-8859-1 (latin1), not UTF-8 — we
 * read the response as bytes and decode explicitly before JSON.parse.
 */

export type SocColaborador = {
  cpf: string;
  nome: string;
  setor?: string;
  cargo?: string;
  codigo_soc?: string;
  unidade_nome?: string;
  unidade_codigo?: string;
};

const SOC_URL = "https://ws1.soc.com.br/WebSoc/exportadados";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function pickString(rec: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Look up a colaborador in SOC by their empresa codigo_soc + cpf.
 * Returns null when SOC has no matching record.
 */
export async function fetchSocColaborador(
  empresaCodigoSoc: string,
  cpf: string,
): Promise<SocColaborador | null> {
  const empresaPrincipal = requireEnv("SOC_EMPRESA_PRINCIPAL");
  const exportCode = requireEnv("SOC_EXPORT_CODE");
  const exportKey = requireEnv("SOC_EXPORT_KEY");

  // SOC's exportadados expects `parametro` as a JSON-ish blob with single
  // quotes — keep the exact format SOC accepts.
  const parametro =
    `{'empresa':'${empresaPrincipal}',` +
    `'codigo':'${exportCode}',` +
    `'chave':'${exportKey}',` +
    `'tipoSaida':'json',` +
    `'empresaTrabalho':'${empresaCodigoSoc}',` +
    `'cpf':'${cpf}',` +
    `'parametroData':'0',` +
    `'dataInicio':'','dataFim':''}`;

  const url = `${SOC_URL}?parametro=${encodeURIComponent(parametro)}`;

  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error(`SOC http ${res.status}`);

  const buf = await res.arrayBuffer();
  const text = new TextDecoder("iso-8859-1").decode(buf);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("SOC returned non-JSON payload");
  }

  const rows: Record<string, unknown>[] = Array.isArray(parsed)
    ? (parsed as Record<string, unknown>[])
    : [];
  if (rows.length === 0) return null;

  const wanted = onlyDigits(cpf);
  const match = rows.find((r) => {
    const v = pickString(r, ["CPFFUNCIONARIO", "CPF"]);
    return v ? onlyDigits(v) === wanted : false;
  }) ?? rows[0];

  const nome = pickString(match, ["NOME", "NOMEFUNCIONARIO"]);
  if (!nome) return null;

  return {
    cpf: wanted,
    nome,
    setor: pickString(match, ["NOMESETOR"]),
    cargo: pickString(match, ["NOMECARGO"]),
    codigo_soc: pickString(match, ["CODIGO", "MATRICULAFUNCIONARIO"]),
    unidade_nome: pickString(match, ["NOMEUNIDADE"]),
    unidade_codigo: pickString(match, ["CODIGOUNIDADE"]),
  };
}
