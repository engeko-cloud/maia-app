import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PublicNavLinks } from "@/components/layout/public-nav-links";
import { PublicMobileMenu } from "@/components/layout/public-mobile-menu";

function deriveInitials(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0]!.slice(0, 2).toUpperCase();
  return (tokens[0]![0]! + tokens[tokens.length - 1]![0]!).toUpperCase();
}

export async function PublicTopBar() {
  const supabase = await getSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  let user: { firstName: string; initials: string } | null = null;
  if (authUser) {
    const { data: row } = await supabase
      .from("usuarios")
      .select("nome")
      .eq("id", authUser.id)
      .single();
    const nome = row?.nome?.trim() ?? "";
    if (nome) {
      const firstName = nome.split(/\s+/)[0]!;
      user = { firstName, initials: deriveInitials(nome) };
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" aria-label="Início" className="shrink-0">
          <Logo size="md" />
        </Link>
        <div className="hidden flex-1 justify-center md:flex">
          <PublicNavLinks />
        </div>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Link
                href="/painel"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground"
              >
                Painel →
              </Link>
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-sm">
                <Avatar size="sm">
                  <AvatarFallback className="bg-[var(--brand-primary-600)] text-[10px] text-white">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{user.firstName}</span>
              </span>
            </>
          ) : (
            <>
              <Link
                href="#inicio"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:bg-muted hover:text-foreground"
              >
                Sobre
              </Link>
              <Button render={<Link href="/login" />}>Entrar</Button>
            </>
          )}
        </div>
        <PublicMobileMenu user={user ? { firstName: user.firstName } : null} />
      </div>
    </header>
  );
}
