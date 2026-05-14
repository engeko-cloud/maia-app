import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um email válido."),
  password: z.string().min(1, "Informe sua senha."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um email válido."),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "As senhas não coincidem.",
  });
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
