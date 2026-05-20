import { z } from "zod";

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "prazo deve ser ISO YYYY-MM-DD");

// zod v4's z.string().uuid() strictly enforces RFC 9562 (version digit 1-8),
// rejecting otherwise well-formed UUID-shaped strings. We use a permissive
// 8-4-4-4-12 hex regex to match the broader UUID surface that Postgres accepts.
const UuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const Uuid = z.string().regex(UuidRegex, "UUID inválido");

export const CausaSchema = z.object({
  causa_id:  z.string().regex(UuidRegex, "UUID inválido").optional(),
  descricao: z.string().min(1, "descrição obrigatória"),
});

export type Causa = z.infer<typeof CausaSchema>;

export const IshikawaEntrySchema = z.object({
  categoria_id: Uuid,
  grau_id:      Uuid.nullable(),
  causas:       z.array(CausaSchema).min(1, "cada categoria precisa de ao menos uma causa"),
});

export const PlanoAcaoEntrySchema = z.object({
  acao:        z.string().min(1),
  responsavel: z.string().min(1),
  prazo:       IsoDate,
  status:      z.enum(["pendente", "em_andamento", "concluida", "cancelada"]),
});

export const ParticipanteEntrySchema = z.object({
  nome:  z.string().min(1),
  email: z.string().email().nullable(),
});

export const FotoEntrySchema = z.object({
  path:    z.string().min(1),
  legenda: z.string().nullable(),
});

export const InvestigacaoDadosSchema = z.object({
  ishikawa:      z.array(IshikawaEntrySchema),
  plano_acao:    z.array(PlanoAcaoEntrySchema),
  participantes: z.array(ParticipanteEntrySchema),
  fotos:         z.array(FotoEntrySchema),
});

export type InvestigacaoDados = z.infer<typeof InvestigacaoDadosSchema>;

/** Drops ishikawa causas with empty descricao and branches that end up with no
 *  causas. Apply before save/submit so partially-populated rows from the editor
 *  don't fail schema validation (descricao.min(1), causas.min(1)). */
export function sanitizeInvestigacaoDados(dados: InvestigacaoDados): InvestigacaoDados {
  return {
    ...dados,
    ishikawa: dados.ishikawa
      .map((b) => ({ ...b, causas: b.causas.filter((c) => c.descricao.trim().length > 0) }))
      .filter((b) => b.causas.length > 0),
  };
}

/** Throws if the dados shape is not ready to finalize.
 *  Rules per spec §3.3:
 *  - dados.ishikawa.length >= 1
 *  - dados.ishikawa[0].causas.length >= 1 (already enforced by the schema)
 *  - dados.plano_acao.length >= 1
 */
export function assertFinalizable(dados: InvestigacaoDados): void {
  if (dados.ishikawa.length === 0) {
    throw new Error("Para finalizar, registre ao menos uma entrada de ishikawa.");
  }
  if (dados.plano_acao.length === 0) {
    throw new Error("Para finalizar, registre ao menos um item no plano de ação.");
  }
}
