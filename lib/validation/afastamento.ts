import { z } from "zod";
import { CID_REGEX } from "@/lib/cid-mask";

export const AfastamentoInputSchema = z.object({
  empresa_id:  z.string().uuid(),
  unidade_id:  z.string().uuid(),
  tipo_id:     z.string().uuid(),
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
  cid:         z.string().optional().refine(
    (v) => !v || CID_REGEX.test(v),
    { message: "CID deve ter formato X00 (letra + 2 dígitos)." },
  ),
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
  ocorrencia_id:   z.string().uuid().optional(),
});

export type AfastamentoInput = z.infer<typeof AfastamentoInputSchema>;
