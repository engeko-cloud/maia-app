import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { AppTopNav } from "@/components/layout/app-top-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle)]">
      <AppTopNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
