import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AppNavRow } from "@/components/layout/app-nav-row";
import { AppUserPill } from "@/components/layout/app-user-pill";
import { AppNotificationBell } from "@/components/layout/app-notification-bell";
import { appNav } from "@/lib/nav";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { isInEquipe } from "@/lib/permissions";

function deriveInitials(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0]!.slice(0, 2).toUpperCase();
  return (tokens[0]![0]! + tokens[tokens.length - 1]![0]!).toUpperCase();
}

export async function AppTopNav() {
  const supabase = await getSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: row } = await supabase
    .from("usuarios")
    .select("nome, administrador")
    .eq("id", authUser.id)
    .single();

  const nome = row?.nome?.trim() ?? "";
  const firstName = nome ? nome.split(/\s+/)[0]! : "Usuário";
  const initials = deriveInitials(nome || firstName);

  const me = await getCurrentUser();

  const groups = appNav.filter((g) => {
    if (g.adminOnly) return me?.administrador === true;
    if (g.requiredEquipe) return isInEquipe(me, g.requiredEquipe);
    return true;
  });

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="relative mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" aria-label="Início" className="shrink-0">
          <Logo size="md" />
        </Link>

        <AppNavRow groups={groups} />

        <div className="ml-auto flex items-center gap-2">
          <AppNotificationBell />
          <AppUserPill firstName={firstName} initials={initials} />
        </div>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-1px] left-4 h-[2px] w-10 bg-[var(--brand-accent-500)]"
        />
      </div>
    </header>
  );
}
