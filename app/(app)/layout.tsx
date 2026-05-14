import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { TopNav } from "@/components/nav/top-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <div className="min-h-screen"><TopNav />{children}</div>;
}
