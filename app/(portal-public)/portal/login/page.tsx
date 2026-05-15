"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const CredSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter exatamente 11 dígitos"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
});
const OtpSchema = z.object({
  code: z.string().length(6, "O código tem exatamente 6 dígitos"),
});

type CredInput = z.infer<typeof CredSchema>;
type OtpInput = z.infer<typeof OtpSchema>;
type Step = "cred" | "otp";

const PITCH = {
  headingWords: ["Seus", "afastamentos,", "sempre", "acessíveis."],
  accentIndex: 1,
  sub: "Consulte o status dos seus afastamentos registrados na ENGEKO a qualquer hora.",
};

export default function PortalLoginPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("cred");
  const [cpf, setCpf] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const credForm = useForm<CredInput>({
    resolver: zodResolver(CredSchema),
    defaultValues: { cpf: "", email: "" },
  });

  const otpForm = useForm<OtpInput>({
    resolver: zodResolver(OtpSchema),
    defaultValues: { code: "" },
  });

  async function onCredSubmit(values: CredInput) {
    setError(null);
    const res = await fetch("/api/portal/login-init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "Erro inesperado." }));
      setError(msg ?? "Erro inesperado.");
      return;
    }
    const supabase = getSupabaseBrowser();
    await supabase.auth.signInWithOtp({
      email: values.email,
      options: { shouldCreateUser: true, data: { cpf: values.cpf } },
    });
    setCpf(values.cpf);
    setEmail(values.email);
    setStep("otp");
  }

  async function onOtpSubmit(values: OtpInput) {
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: values.code,
      type: "email",
    });
    if (error) {
      setError("Código inválido ou expirado. Solicite um novo código.");
      return;
    }
    router.push("/portal/painel");
    router.refresh();
  }

  return (
    <AuthCard
      title="Área do Colaborador"
      lead={
        step === "cred"
          ? "Informe seu CPF e email para receber o código de acesso."
          : `Enviamos um código de 6 dígitos para ${email}.`
      }
      pitch={PITCH}
    >
      {step === "cred" ? (
        <Form {...credForm}>
          <form onSubmit={credForm.handleSubmit(onCredSubmit)} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <FormField
              control={credForm.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="Somente números"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={credForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full border-b-[3px] border-[var(--brand-accent-500)]"
              disabled={credForm.formState.isSubmitting}
            >
              {credForm.formState.isSubmitting ? "Verificando…" : "Enviar código"}
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...otpForm}>
          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <FormField
              control={otpForm.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de 6 dígitos</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="one-time-code"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full border-b-[3px] border-[var(--brand-accent-500)]"
              disabled={otpForm.formState.isSubmitting}
            >
              {otpForm.formState.isSubmitting ? "Verificando…" : "Entrar"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep("cred");
                setError(null);
                setCpf("");
                setEmail("");
                credForm.reset();
              }}
              className="w-full text-sm text-[var(--color-fg-muted)] hover:text-foreground"
            >
              Tentar novamente
            </button>
          </form>
        </Form>
      )}
    </AuthCard>
  );
}
