import { z } from "zod";

// Regex UUID para compatibilidade com zod v4 (que usa RFC 4122 estrito)
const uuidLike = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  "UUID inválido",
);

export const AfastamentoInputSchema = z.object({
  empresa_id:  uuidLike,
  unidade_id:  uuidLike,
  tipo_id:     uuidLike,
  cpf:         z.string().regex(/^\d{11}$/),
  colaborador_nome:       z.string().min(2),
  colaborador_setor:      z.string().optional(),
  colaborador_cargo:      z.string().optional(),
  colaborador_codigo_soc: z.string().optional(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora_inicio: z.string().optional(),
  data_fim:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora_fim:    z.string().optional(),
  duracao:     z.number().int().min(0).optional(),
  cid:         z.string().optional(),
  emissor:     z.object({
    tipo: z.enum(["CRM", "CRO"]),
    no:   z.string().min(1),
    uf:   z.string().length(2),
  }).optional(),
  inss:        z.boolean().optional(),
  acidente:    z.boolean().optional(),
  internacao:  z.boolean().optional(),
  email_remetente: z.string().email(),
  arquivo_url: z.string().optional(),
});

export type AfastamentoInput = z.infer<typeof AfastamentoInputSchema>;
