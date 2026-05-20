import { z } from "zod";
import { CID_REGEX } from "@/lib/cid-mask";

export const AfastamentoInputSchema = z.object({
  empresa_id:  z.string().uuid("Selecione a empresa."),
  unidade_id:  z.string().uuid("Unidade não reconhecida — refaça a busca pelo CPF."),
  tipo_id:     z.string().uuid("Selecione o tipo de afastamento."),
  cpf:         z.string().regex(/^\d{11}$/, "CPF inválido — informe 11 dígitos numéricos."),
  colaborador_nome:       z.string().min(2, "Informe o nome do colaborador."),
  colaborador_setor:      z.string().optional(),
  colaborador_cargo:      z.string().optional(),
  colaborador_codigo_soc: z.string().optional(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de início inválida."),
  hora_inicio: z.string().optional().transform((v) => v || undefined),
  data_fim:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data fim inválida.").optional(),
  hora_fim:    z.string().optional().transform((v) => v || undefined),
  duracao:     z.number().int().min(0, "A duração não pode ser negativa.").optional(),
  cid:         z.string().optional().refine(
    (v) => !v || CID_REGEX.test(v),
    { message: "CID deve ter formato X00 (letra + 2 dígitos)." },
  ),
  emissor:     z.object({
    tipo: z.enum(["CRM", "CRO"] as const, { error: "Selecione CRM ou CRO." } as any),
    no:   z.string().min(1, "Informe o número do registro (CRM/CRO)."),
    uf:   z.string().length(2, "Informe a UF com 2 letras."),
  }).optional(),
  inss:        z.boolean().optional(),
  acidente:    z.boolean().optional(),
  internacao:  z.boolean().optional(),
  email_remetente: z.string().email("Informe um e-mail válido para retorno."),
  arquivo_url: z.string().optional(),
  ocorrencia_id:   z.string().uuid().optional(),
});

export type AfastamentoInput = z.infer<typeof AfastamentoInputSchema>;
