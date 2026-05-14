import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AppTopNav } from "@/components/layout/app-top-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: u } = await supabase
    .from("usuarios")
    .select("administrador")
    .eq("id", user.id)
    .single();
  if (!u?.administrador) redirect("/painel");

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)]">
      <AppTopNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
