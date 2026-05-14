"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/auth-schemas";
import { translateAuthError } from "@/lib/auth-errors";

export default function ForgotPasswordPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setErrorMessage(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_BASE_URL ?? window.location.origin}/update-password`,
    });
    if (error) {
      setErrorMessage(translateAuthError(error));
      return;
    }
    setSubmittedEmail(values.email);
  }

  return (
    <AuthCard
      title="Recuperar senha"
      lead="Enviaremos um link para você criar uma nova senha."
      pitch={{
        headingWords: ["Recupere", "rápido,", "volte", "ao", "trabalho."],
        accentIndex: 1,
        sub: "O link chega no seu email institucional em segundos. Sem ligações, sem esperas.",
      }}
    >
      {submittedEmail ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Verifique seu email</h2>
          <p className="text-sm text-muted-foreground">
            Se houver uma conta para <strong>{submittedEmail}</strong>, você
            receberá um link em instantes. Não esqueça de conferir a pasta de
            spam.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm text-muted-foreground hover:text-primary"
          >
            ← Voltar para login
          </Link>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {errorMessage}
              </div>
            )}
            <FormField
              control={form.control}
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
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Enviando…"
                : "Enviar link de recuperação"}
            </Button>
            <Link
              href="/login"
              className="block text-center text-sm text-muted-foreground hover:text-primary"
            >
              ← Voltar para login
            </Link>
          </form>
        </Form>
      )}
    </AuthCard>
  );
}
