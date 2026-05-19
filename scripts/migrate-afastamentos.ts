import { fileURLToPath } from "node:url";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

export interface NewAfastamento {
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
    decidido_por:      (() => {
      if (!row.aprovado_por) return null;
      const mapped = maps.userMap.get(row.aprovado_por);
      if (!mapped) console.warn(`[WARN] id=${row.id}: aprovado_por "${row.aprovado_por}" not in userMap, setting decidido_por=null`);
      return mapped ?? null;
    })(),
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

// ── Map builders ─────────────────────────────────────────────────────────────

async function buildTipoMap(
  newClient: SupabaseClient
): Promise<Map<string, string>> {
  const { data: raw, error } = await newClient
    .from("afastamento_tipos")
    .select("id, codigo");
  if (error) throw error;
  const data = (raw ?? []) as Array<{ id: string; codigo: string }>;
  return new Map(data.map((r) => [r.codigo, r.id]));
}

async function buildEmpresaMap(
  newClient: SupabaseClient
): Promise<Map<string, string>> {
  const { data: raw, error } = await newClient
    .from("empresas")
    .select("id, codigo_fluig")
    .not("codigo_fluig", "is", null);
  if (error) throw error;
  const data = (raw ?? []) as Array<{ id: string; codigo_fluig: string }>;
  return new Map(data.map((r) => [r.codigo_fluig, r.id]));
}

async function buildUnidadeMap(
  legacyClient: SupabaseClient,
  newClient: SupabaseClient
): Promise<Map<number, string>> {
  const [{ data: rawLegacy, error: e1 }, { data: rawNew, error: e2 }] =
    await Promise.all([
      legacyClient.from("unidades").select("id, codigo"),
      newClient.from("unidades").select("id, codigo"),
    ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (!rawLegacy) throw new Error("legacyClient unidades query returned null data");
  if (!rawNew) throw new Error("newClient unidades query returned null data");

  const legacyUnidades = rawLegacy as Array<{ id: number; codigo: string }>;
  const newUnidades = rawNew as Array<{ id: string; codigo: string }>;

  const newByCodigo = new Map(newUnidades.map((u) => [u.codigo, u.id]));
  const map = new Map<number, string>();
  for (const lu of legacyUnidades) {
    const newId = newByCodigo.get(lu.codigo);
    if (newId) {
      map.set(lu.id, newId);
    } else {
      console.warn(
        `[WARN] Legacy unidade id=${lu.id} codigo="${lu.codigo}" not found in new DB`
      );
    }
  }
  return map;
}

async function buildUserMap(
  legacyClient: SupabaseClient,
  newClient: SupabaseClient
): Promise<Map<string, string>> {
  const [{ data: authData, error: e1 }, { data: rawUsers, error: e2 }] =
    await Promise.all([
      legacyClient.auth.admin.listUsers({ perPage: 1000 }),
      newClient.from("usuarios").select("id, email"),
    ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (!authData) throw new Error("listUsers returned no data");
  if (!rawUsers) throw new Error("newClient usuarios query returned null data");

  const newUsers = rawUsers as Array<{ id: string; email: string }>;
  const newByEmail = new Map(newUsers.map((u) => [u.email, u.id]));
  const map = new Map<string, string>();
  for (const lu of authData.users) {
    if (!lu.email) continue;
    const newId = newByEmail.get(lu.email);
    if (newId) {
      map.set(lu.id, newId);
    } else {
      console.warn(`[WARN] Legacy user ${lu.email} not found in new DB`);
    }
  }
  return map;
}

// ── Legacy credentials (delete this file after migration) ────────────────────

const LEGACY_URL = "https://zgdemniuryzfohgxdafu.supabase.co";
const LEGACY_SERVICE_KEY = "PASTE_LEGACY_SERVICE_KEY_HERE";

// ── Migration runner ──────────────────────────────────────────────────────────

const PAGE_SIZE = 500;

async function runMigration(
  legacyClient: SupabaseClient,
  newClient: SupabaseClient,
  maps: LookupMaps,
  dryRun: boolean
): Promise<void> {
  const { count, error: countError } = await legacyClient
    .from("afastamentos")
    .select("*", { count: "exact", head: true });
  if (countError) throw countError;

  const total = count ?? 0;
  console.log(`Total legacy records: ${total}`);

  let offset = 0;
  let migrated = 0;
  let skipped = 0;

  while (offset < total) {
    const { data: rows, error } = await legacyClient
      .from("afastamentos")
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    const transformed = rows
      .map((r) => transformRow(r as LegacyAfastamento, maps))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    skipped += rows.length - transformed.length;

    if (dryRun) {
      if (offset === 0) {
        console.log("\n[DRY RUN] First 5 transformed rows:");
        console.log(JSON.stringify(transformed.slice(0, 5), null, 2));
        console.log("\n[DRY RUN] No data written. Exiting.");
      }
      break;
    }

    const { error: upsertError } = await newClient
      .from("afastamentos")
      .upsert(transformed as never[], { onConflict: "serial_id" });
    if (upsertError) throw upsertError;

    migrated += transformed.length;
    offset += rows.length;
    console.log(`[${offset}/${total}] migrated=${migrated} skipped=${skipped}`);
  }

  if (!dryRun) {
    console.log(`\nMigration complete. migrated=${migrated} skipped=${skipped}`);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("[DRY RUN] Building maps and previewing transform only.\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }

  const legacyClient = createClient(LEGACY_URL, LEGACY_SERVICE_KEY);
  const newClient = createClient(supabaseUrl, serviceKey);

  console.log("Building lookup maps...");
  const [tipoMap, empresaMap, unidadeMap, userMap] = await Promise.all([
    buildTipoMap(newClient),
    buildEmpresaMap(newClient),
    buildUnidadeMap(legacyClient, newClient),
    buildUserMap(legacyClient, newClient),
  ]);

  console.log(
    `Maps ready — tipos:${tipoMap.size} empresas:${empresaMap.size} unidades:${unidadeMap.size} users:${userMap.size}`
  );

  await runMigration(legacyClient, newClient, { tipoMap, empresaMap, unidadeMap, userMap }, dryRun);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
