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

const Schema = z.object({
  cpf: z
    .string()
    .regex(/^\d{11}$/, "CPF deve ter exatamente 11 dígitos numéricos (sem pontos ou traços)"),
});

type FormInput = z.infer<typeof Schema>;

const PITCH = {
  headingWords: ["Um", "passo", "para", "começar."],
  accentIndex: 1,
  sub: "Informe seu CPF para vincular seus registros à sua conta e acessar o portal.",
};

export default function PortalCadastroPage() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<FormInput>({
    resolver: zodResolver(Schema),
    defaultValues: { cpf: "" },
  });

  async function onSubmit(values: FormInput) {
    setServerError(null);
    const res = await fetch("/api/portal/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf: values.cpf }),
    });
    if (res.ok) {
      router.push("/portal/painel");
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setServerError(body.error ?? "Erro ao cadastrar. Tente novamente.");
  }

  return (
    <AuthCard
      title="Vincular CPF"
      lead="Informe seu CPF para acessar seus registros de afastamento."
      pitch={PITCH}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}
          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="11 dígitos sem pontos ou traços"
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
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Salvando…" : "Confirmar"}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
