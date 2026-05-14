import { z } from "zod";

export const OcorrenciaInputSchema = z.object({
  empresa_id:      z.string().uuid(),
  unidade_id:      z.string().uuid(),
  tipo:            z.string().min(1),
  data_ocorrencia: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  email_remetente: z.string().email(),
  descricao:       z.string().min(10),
  arquivo_url:     z.string().optional(),
});

export type OcorrenciaInput = z.infer<typeof OcorrenciaInputSchema>;
