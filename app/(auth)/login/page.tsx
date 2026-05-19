"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { loginSchema, type LoginInput } from "@/lib/auth-schemas";
import { translateAuthError } from "@/lib/auth-errors";

const magicSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um email válido."),
});
type MagicInput = z.infer<typeof magicSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"senha" | "magic">("senha");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const passwordForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const magicForm = useForm<MagicInput>({
    resolver: zodResolver(magicSchema),
    defaultValues: { email: "" },
  });

  async function onPasswordSubmit(values: LoginInput) {
    setErrorMessage(null);
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setErrorMessage(translateAuthError(error));
      return;
    }
    const userId = data.user?.id;
    if (userId) {
      const { data: me } = await supabase
        .from("usuarios")
        .select("primeiro_acesso")
        .eq("id", userId)
        .single();
      if ((me as any)?.primeiro_acesso) {
        router.push("/update-password?first=1");
        return;
      }
    }
    router.push("/app/painel");
    router.refresh();
  }

  async function onMagicSubmit(values: MagicInput) {
    setErrorMessage(null);
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: values.email }),
    });
    if (!res.ok) {
      setErrorMessage("Erro ao enviar link. Tente novamente.");
      return;
    }
    setMagicSent(true);
  }

  function switchMode(next: "senha" | "magic") {
    setMode(next);
    setErrorMessage(null);
    setMagicSent(false);
  }

  return (
    <AuthCard
      title={mode === "magic" ? "Link de acesso" : "Entrar"}
      lead={
        mode === "magic"
          ? "Enviaremos um link para você entrar sem precisar de senha."
          : "Acesse sua conta para gerenciar afastamentos e ocorrências."
      }
      pitch={{
        headingWords: ["Saúde", "ocupacional,", "sem", "fricção."],
        accentIndex: 1,
        sub: "Aprovações, investigações e relatórios em um único painel — feito para a equipe de SST da ENGEKO.",
      }}
    >
      {mode === "magic" && magicSent ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Verifique seu email</h2>
          <p className="text-sm text-muted-foreground">
            Se houver uma conta para <strong>{magicForm.getValues("email")}</strong>, você
            receberá um link em instantes. Não esqueça de conferir a pasta de spam.
          </p>
          <button
            type="button"
            onClick={() => switchMode("senha")}
            className="text-sm text-muted-foreground hover:text-primary"
          >
            ← Voltar para login
          </button>
        </div>
      ) : mode === "magic" ? (
        <Form {...magicForm}>
          <form onSubmit={magicForm.handleSubmit(onMagicSubmit)} className="space-y-4">
            {errorMessage && (
              <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            <FormField
              control={magicForm.control}
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
              disabled={magicForm.formState.isSubmitting}
            >
              {magicForm.formState.isSubmitting ? "Enviando…" : "Enviar link de acesso"}
            </Button>
            <button
              type="button"
              onClick={() => switchMode("senha")}
              className="block w-full text-center text-sm text-muted-foreground hover:text-primary"
            >
              ← Entrar com senha
            </button>
          </form>
        </Form>
      ) : (
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            {errorMessage && (
              <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            <FormField
              control={passwordForm.control}
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
              control={passwordForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Senha</FormLabel>
                    <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-primary">
                      Esqueci a senha
                    </Link>
                  </div>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full border-b-[3px] border-[var(--brand-accent-500)]"
              disabled={passwordForm.formState.isSubmitting}
            >
              {passwordForm.formState.isSubmitting ? "Entrando…" : "Entrar"}
            </Button>
            <button
              type="button"
              onClick={() => switchMode("magic")}
              className="block w-full text-center text-sm text-muted-foreground hover:text-primary"
            >
              Entrar com link mágico
            </button>
          </form>
        </Form>
      )}
    </AuthCard>
  );
}
