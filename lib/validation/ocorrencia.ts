import { z } from "zod";
import { CID_REGEX } from "@/lib/cid-mask";

export const OcorrenciaInputSchema = z.object({
  empresa_id:             z.string().uuid(),
  unidade_id:             z.string().uuid(),
  tipo:                   z.string().min(1),
  data_ocorrencia:        z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  hora_ocorrencia:        z.string().optional(),
  email_remetente:        z.string().email(),
  descricao:              z.string().min(10),
  arquivo_url:            z.string().optional(),

  // vítima
  cpf:                    z.string().regex(/^\d{11}$/).optional().or(z.literal("")),
  colaborador_nome:       z.string().optional(),
  colaborador_setor:      z.string().optional(),
  colaborador_cargo:      z.string().optional(),
  colaborador_codigo_soc: z.string().optional(),
  relacao_vitima:         z.enum(["colaborador","terceiro","visitante"]).optional(),
  dut:                    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // local
  tipo_local:             z.enum(["proprio","terceiros","via"]).optional(),
  cnpj_local:             z.string().optional(),
  texto_local:            z.string().optional(),

  // atendimento médico
  atendimento:            z.boolean().optional(),
  data_atendimento:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora_atendimento:       z.string().optional(),
  afastamento:            z.boolean().optional(),
  duracao_afastamento:    z.number().int().min(0).optional(),
  internacao:             z.boolean().optional(),
  cid:                    z.string().optional().refine(
    (v) => !v || CID_REGEX.test(v),
    { message: "CID deve ter formato X00 (letra + 2 dígitos)." },
  ),
  emissor:                z.object({
    tipo: z.enum(["CRM","CRO"]),
    no:   z.string().min(1),
    uf:   z.string().length(2),
  }).optional(),
  parecer_medico:         z.string().optional(),
  morte:                  z.boolean().optional(),
  bo:                     z.boolean().optional(),
  no_bo:                  z.string().optional(),
}).superRefine((val, ctx) => {
  if (val.relacao_vitima && !val.dut) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dut"],
      message: "Último dia trabalhado obrigatório quando há vítima.",
    });
  }
});

export type OcorrenciaInput = z.infer<typeof OcorrenciaInputSchema>;
