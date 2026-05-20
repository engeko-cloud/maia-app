"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
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
  updatePasswordSchema,
  type UpdatePasswordInput,
} from "@/lib/auth-schemas";
import { translateAuthError } from "@/lib/auth-errors";

const SESSION_EXPIRED_MESSAGE = "Sua sessão expirou. Solicite um novo link.";

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={null}>
      <UpdatePasswordForm />
    </Suspense>
  );
}

function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFirstAccess = searchParams.get("first") === "1";
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: UpdatePasswordInput) {
    setErrorMessage(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    if (error) {
      setErrorMessage(translateAuthError(error));
      return;
    }
    if (isFirstAccess) {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primeiro_acesso: false }),
      }).catch(() => {});
    }
    toast.success("Senha atualizada.");
    router.push("/app/painel");
  }

  const sessionExpired = errorMessage === SESSION_EXPIRED_MESSAGE;

  return (
    <AuthCard
      title={isFirstAccess ? "Crie sua senha de acesso" : "Nova senha"}
      lead={
        isFirstAccess
          ? "Escolha uma senha pessoal para substituir a senha temporária."
          : "Defina uma senha que só você conhece."
      }
      pitch={{
        headingWords: ["Senhas", "fortes,", "dados", "protegidos."],
        accentIndex: 1,
        sub: "Mínimo de 8 caracteres. Use uma combinação que você lembre — letras, números e símbolos.",
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
              {sessionExpired && (
                <>
                  {" "}
                  <Link href="/forgot-password" className="underline underline-offset-2">
                    Solicitar novo link
                  </Link>
                </>
              )}
            </div>
          )}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova senha</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormDescription>Mínimo de 8 caracteres.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar senha</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
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
            {form.formState.isSubmitting ? "Salvando…" : "Atualizar senha"}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
