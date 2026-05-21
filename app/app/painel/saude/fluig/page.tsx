import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getFluigEventos, type FluigEventosFilters } from "@/lib/dashboard/fluig-eventos";
import { FluigEventosTable } from "@/components/saude/fluig-eventos-table";

const PAGE_SIZE = 25;

function parseStatus(v: string | undefined): FluigEventosFilters["status"] {
  return v === "enviado" || v === "erro" || v === "pending" ? v : "all";
}

function pick(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function PainelFluigEventosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireAdminUser();
  if (!me) redirect("/app/painel");

  const sp = await searchParams;
  const filters: FluigEventosFilters = {
    status: parseStatus(pick(sp.status)),
    q: pick(sp.q),
    from: pick(sp.from) || null,
    to: pick(sp.to) || null,
  };
  const page = Math.max(1, Number(pick(sp.page) || "1"));

  const admin = getSupabaseAdmin();
  const initial = await getFluigEventos(admin, filters, page, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/app/painel" className="hover:text-foreground">Painel</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <Link href="/app/painel/saude" className="hover:text-foreground">Saúde</Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">Eventos Fluig</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Eventos Fluig</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Histórico completo de envios e falhas para a integração Fluig.
        </p>
      </header>
      <FluigEventosTable initial={initial} initialFilters={filters} />
    </div>
  );
}
