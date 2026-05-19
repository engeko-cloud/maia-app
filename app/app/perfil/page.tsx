"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { UserIcon, LockIcon, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { updatePasswordSchema, type UpdatePasswordInput } from "@/lib/auth-schemas";
import { translateAuthError } from "@/lib/auth-errors";

const profileSchema = z.object({
  nome:      z.string().min(2, "Nome precisa ter ao menos 2 caracteres."),
  sobrenome: z.string().optional(),
});
type ProfileInput = z.infer<typeof profileSchema>;

interface Me {
  id: string;
  email: string;
  nome: string | null;
  sobrenome: string | null;
  avatar_url: string | null;
}

function deriveInitials(nome: string | null, sobrenome: string | null): string {
  const first = nome?.trim()[0] ?? "?";
  const last  = sobrenome?.trim()[0] ?? "";
  return (first + last).toUpperCase();
}

export default function PerfilPage() {
  const [me, setMe] = React.useState<Me | null>(null);
  const [avatarBusy, setAvatarBusy] = React.useState(false);

  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { nome: "", sobrenome: "" },
  });

  const passwordForm = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data: Me) => {
        setMe(data);
        profileForm.reset({ nome: data.nome ?? "", sobrenome: data.sobrenome ?? "" });
      })
      .catch(() => toast.error("Erro ao carregar perfil."));
  }, [profileForm]);

  async function onProfileSubmit(values: ProfileInput) {
    const r = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!r.ok) { toast.error("Erro ao salvar."); return; }
    setMe((prev) => prev ? { ...prev, ...values } : prev);
    toast.success("Dados atualizados.");
  }

  async function onPasswordSubmit(values: UpdatePasswordInput) {
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) { toast.error(translateAuthError(error)); return; }
    toast.success("Senha atualizada.");
    passwordForm.reset();
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const r = await fetch("/api/me/avatar", { method: "POST", body });
      if (!r.ok) { toast.error("Erro ao enviar foto."); return; }
      const { avatar_url } = await r.json() as { avatar_url: string };
      setMe((prev) => prev ? { ...prev, avatar_url } : prev);
      toast.success("Foto atualizada.");
    } finally {
      setAvatarBusy(false);
      e.target.value = "";
    }
  }

  const initials = me ? deriveInitials(me.nome, me.sobrenome) : "?";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header className="border-b border-[var(--color-border)] pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">{me?.email ?? "…"}</p>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <ImageIcon className="size-4 text-[var(--color-fg-muted)]" aria-hidden="true" />
          <h2 className="font-medium">Foto de perfil</h2>
        </div>
        <div className="flex items-center gap-4">
          <Avatar size="lg">
            {me?.avatar_url && <AvatarImage src={me.avatar_url} alt="Foto de perfil" />}
            <AvatarFallback className="bg-[var(--brand-primary-600)] text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="avatar-upload"
              className="cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-bg-subtle)]"
            >
              {avatarBusy ? "Enviando…" : "Alterar foto"}
            </Label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={avatarBusy}
              onChange={onAvatarChange}
            />
            <p className="text-xs text-[var(--color-fg-muted)]">JPEG, PNG ou WebP. Máx. 5 MB.</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <UserIcon className="size-4 text-[var(--color-fg-muted)]" aria-hidden="true" />
          <h2 className="font-medium">Dados pessoais</h2>
        </div>
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={profileForm.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="sobrenome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sobrenome</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div>
              <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                {profileForm.formState.isSubmitting ? "Salvando…" : "Salvar dados"}
              </Button>
            </div>
          </form>
        </Form>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <LockIcon className="size-4 text-[var(--color-fg-muted)]" aria-hidden="true" />
          <h2 className="font-medium">Senha</h2>
        </div>
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="flex flex-col gap-4">
            <FormField
              control={passwordForm.control}
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
              control={passwordForm.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar nova senha</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                {passwordForm.formState.isSubmitting ? "Atualizando…" : "Alterar senha"}
              </Button>
            </div>
          </form>
        </Form>
      </section>
    </div>
  );
}
