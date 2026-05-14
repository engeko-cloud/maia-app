"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { loginSchema, type LoginInput } from "@/lib/auth-schemas";
import { translateAuthError } from "@/lib/auth-errors";

export default function LoginPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setErrorMessage(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setErrorMessage(translateAuthError(error));
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  return (
    <AuthCard
      title="Entrar"
      lead="Acesse sua conta para gerenciar afastamentos e ocorrências."
      pitch={{
        headingWords: ["Saúde", "ocupacional,", "sem", "fricção."],
        accentIndex: 1,
        sub: "Aprovações, investigações e relatórios em um único painel — feito para a equipe de SST da ENGEKO.",
      }}
    >
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
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Senha</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    Esqueci a senha
                  </Link>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
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
            {form.formState.isSubmitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
