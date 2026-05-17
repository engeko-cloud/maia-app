import {
  CheckCircle2Icon,
  FileEditIcon,
  ListChecksIcon,
  AlertTriangleIcon,
  SearchIcon,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import { isAdmin, isInEquipe } from "@/lib/permissions";
import { greetingFor } from "@/lib/greeting";
import { buildHeroContent } from "@/lib/painel-hero-content";
import { PainelHero } from "@/components/painel/painel-hero";
import { QuickAction } from "@/components/painel/quick-action";
import { KpiCard } from "@/components/painel/kpi-card";
import {
  ActivityFeed,
  type ActivityFeedRow,
} from "@/components/painel/activity-feed";
import { SaudeBanner } from "@/components/saude/saude-banner";

interface EventoRow {
  id: string;
  tipo_entidade: ActivityFeedRow["tipo_entidade"];
  entidade_id: string;
  evento: ActivityFeedRow["evento"];
  ocorrido_em: string;
  usuarios: { nome: string | null; sobrenome: string | null } | null;
}

export default async function PainelPage() {
  const [me, supabase] = await Promise.all([
    getCurrentUser(),
    getSupabaseServer(),
  ]);

  const isUserAdmin = isAdmin(me);
  const showOh = isInEquipe(me, "oh");
  const showSafety = isInEquipe(me, "safety");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nome")
    .eq("id", me!.id)
    .single();
  const firstName = (usuario?.nome?.trim() || "").split(/\s+/)[0] || "Usuário";

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    pendentesRes,
    ativosRes,
    ocorrenciasAbertasRes,
    ocorrenciasMesRes,
    investigacoesPendentesRes,
    recentesRes,
  ] = await Promise.all([
    showOh
      ? supabase
          .from("afastamentos")
          .select("id", { count: "exact", head: true })
          .eq("situacao", "pendente")
      : Promise.resolve({ count: 0 }),
    showOh
      ? supabase
          .from("afastamentos")
          .select("id", { count: "exact", head: true })
          .in("situacao", ["aprovado", "em_andamento"])
      : Promise.resolve({ count: 0 }),
    showSafety
      ? supabase
          .from("ocorrencias")
          .select("id", { count: "exact", head: true })
          .eq("situacao", "aberta")
      : Promise.resolve({ count: 0 }),
    showSafety
      ? supabase
          .from("ocorrencias")
          .select("id", { count: "exact", head: true })
          .gte("criado_em", startOfMonth)
      : Promise.resolve({ count: 0 }),
    showSafety
      ? supabase
          .from("investigacoes")
          .select("id", { count: "exact", head: true })
          .in("situacao", ["em_andamento", "em_aprovacao"])
      : Promise.resolve({ count: 0 }),
    supabase
      .from("eventos")
      .select(
        "id, tipo_entidade, entidade_id, evento, ocorrido_em, usuarios:autor_id(nome, sobrenome)",
      )
      .order("ocorrido_em", { ascending: false })
      .limit(5)
      .returns<EventoRow[]>(),
  ]);

  const pendentes = pendentesRes.count ?? 0;
  const ativos = ativosRes.count ?? 0;
  const ocorrenciasAbertas = ocorrenciasAbertasRes.count ?? 0;
  const ocorrenciasMes = ocorrenciasMesRes.count ?? 0;
  const investigacoesPendentes = investigacoesPendentesRes.count ?? 0;

  const recentes: ActivityFeedRow[] = (recentesRes.data ?? []).map((row) => ({
    id: row.id,
    tipo_entidade: row.tipo_entidade,
    entidade_id: row.entidade_id,
    evento: row.evento,
    ocorrido_em: row.ocorrido_em,
    autor_nome:
      [row.usuarios?.nome, row.usuarios?.sobrenome].filter(Boolean).join(" ") ||
      null,
  }));

  const greeting = greetingFor(now.getHours());
  const formattedDate = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const hero = buildHeroContent({
    isAdmin: isUserAdmin,
    showOh,
    showSafety,
    pendentes,
    investigacoesPendentes,
  });

  const activitySeeAllHref = showOh ? "/app/afastamentos" : "/app/ocorrencias";

  return (
    <div className="space-y-6">
      <SaudeBanner />
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
            Painel
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {greeting}, {firstName}.
          </p>
        </div>
        <p className="font-mono text-xs text-[var(--color-fg-subtle)] first-letter:uppercase">
          {formattedDate}
        </p>
      </header>

      <PainelHero
        headline={hero.headline}
        sub={hero.sub}
        ctas={hero.ctas}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {showOh && (
            <>
              <QuickAction
                href="/app/afastamentos/aprovacoes"
                icon={CheckCircle2Icon}
                title="Aprovações"
                sub="Revisar afastamentos pendentes"
                tone={pendentes > 0 ? "accent" : "primary"}
                count={pendentes}
              />
              <QuickAction
                href="/app/afastamentos"
                icon={ListChecksIcon}
                title="Afastamentos"
                sub="Lista completa"
                tone="primary"
              />
            </>
          )}
          {showSafety && (
            <>
              <QuickAction
                href="/app/ocorrencias"
                icon={AlertTriangleIcon}
                title="Ocorrências"
                sub="Aberturas e investigações"
                tone={ocorrenciasAbertas > 0 ? "accent" : "primary"}
                count={ocorrenciasAbertas}
              />
              <QuickAction
                href="/app/investigacoes"
                icon={SearchIcon}
                title="Investigações"
                sub="Gerir investigações abertas"
                tone="primary"
              />
            </>
          )}
          <QuickAction
            href="/forms/ocorrencias"
            icon={AlertTriangleIcon}
            title="Nova ocorrência"
            sub="Formulário público"
            tone="primary"
          />
          {showOh && (
            <QuickAction
              href="/forms/afastamentos"
              icon={FileEditIcon}
              title="Novo afastamento"
              sub="Formulário público"
              tone="primary"
            />
          )}
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {showOh && (
              <>
                <KpiCard
                  label="Afastamentos ativos"
                  value={ativos}
                  delta={ativos === 0 ? "—" : `${ativos} em curso`}
                  tone={ativos > 0 ? "accent" : "primary"}
                />
                <KpiCard
                  label="Aprovações pendentes"
                  value={pendentes}
                  delta={pendentes === 0 ? "—" : `${pendentes} aguardando revisão`}
                  tone={pendentes > 0 ? "accent" : "primary"}
                />
              </>
            )}
            {showSafety && (
              <>
                <KpiCard
                  label="Ocorrências no mês"
                  value={ocorrenciasMes}
                  delta={ocorrenciasMes === 0 ? "—" : `${ocorrenciasMes} este mês`}
                  tone={ocorrenciasMes > 0 ? "accent" : "primary"}
                />
                <KpiCard
                  label="Investigações pendentes"
                  value={investigacoesPendentes}
                  delta={
                    investigacoesPendentes === 0
                      ? "—"
                      : `${investigacoesPendentes} aguardando conclusão`
                  }
                  tone={investigacoesPendentes > 0 ? "accent" : "primary"}
                />
              </>
            )}
          </div>
          <ActivityFeed rows={recentes} seeAllHref={activitySeeAllHref} />
        </div>
      </div>
    </div>
  );
}
