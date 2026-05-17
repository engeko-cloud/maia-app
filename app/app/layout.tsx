import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { AppFooter } from "@/components/layout/app-footer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("usuarios")
    .select("administrador, equipe_usuarios(equipe_id)")
    .eq("id", user.id)
    .single();
  const isStaff =
    profile?.administrador === true ||
    (Array.isArray((profile as { equipe_usuarios?: unknown[] } | null)?.equipe_usuarios) &&
      ((profile as { equipe_usuarios?: unknown[] })!.equipe_usuarios!.length ?? 0) > 0);
  if (!isStaff) redirect("/");

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)] pb-14">
      <AppTopNav />
      <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-10">{children}</main>
      <AppFooter />
    </div>
  );
}
