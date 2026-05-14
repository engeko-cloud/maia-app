import {
  CheckCircle2Icon,
  FileEditIcon,
  ListChecksIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { greetingFor } from "@/lib/greeting";
import { PainelHero } from "@/components/painel/painel-hero";
import { QuickAction } from "@/components/painel/quick-action";
import { KpiCard } from "@/components/painel/kpi-card";
import {
  ActivityFeed,
  type ActivityFeedRow,
} from "@/components/painel/activity-feed";

interface EventoRow {
  id: string;
  tipo_entidade: ActivityFeedRow["tipo_entidade"];
  entidade_id: string;
  evento: ActivityFeedRow["evento"];
  ocorrido_em: string;
  usuarios: { nome: string | null } | null;
}

export default async function PainelPage() {
  const supabase = await getSupabaseServer();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nome")
    .eq("id", authUser!.id)
    .single();
  const firstName = (usuario?.nome?.trim() || "").split(/\s+/)[0] || "Usuário";

  const [pendentesRes, ativosRes, ocorrenciasAbertasRes, recentesRes] =
    await Promise.all([
      supabase
        .from("afastamentos").select("id", { count: "exact", head: true })
        .eq("situacao", "pendente"),
      supabase
        .from("afastamentos").select("id", { count: "exact", head: true })
        .in("situacao", ["aprovado", "em_andamento"]),
      supabase
        .from("ocorrencias").select("id", { count: "exact", head: true })
        .eq("situacao", "aberta"),
      supabase
        .from("eventos")
        .select("id, tipo_entidade, entidade_id, evento, ocorrido_em, usuarios:autor_id(nome)")
        .order("ocorrido_em", { ascending: false })
        .limit(5)
        .returns<EventoRow[]>(),
    ]);

  const pendentes = pendentesRes.count ?? 0;
  const ativos = ativosRes.count ?? 0;
  const ocorrenciasAbertas = ocorrenciasAbertasRes.count ?? 0;

  const recentes: ActivityFeedRow[] = (recentesRes.data ?? []).map((row) => ({
    id: row.id,
    tipo_entidade: row.tipo_entidade,
    entidade_id: row.entidade_id,
    evento: row.evento,
    ocorrido_em: row.ocorrido_em,
    autor_nome: row.usuarios?.nome ?? null,
  }));

  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const formattedDate = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const heroHeadline =
    pendentes === 0
      ? "Nada pendente — tudo em dia."
      : `${pendentes} ${pendentes === 1 ? "aprovação aguardando" : "aprovações aguardando"} sua revisão.`;
  const heroSub =
    pendentes === 0
      ? "Acompanhe os afastamentos ativos e as ocorrências abertas pelos cartões abaixo."
      : "Revise as solicitações pendentes antes do fim do dia para manter o fluxo.";

  return (
    <div className="space-y-6">
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
        headline={heroHeadline}
        sub={heroSub}
        cta={pendentes > 0 ? { href: "/afastamentos/aprovacoes", label: "Ver aprovações" } : undefined}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QuickAction
            href="/afastamentos/aprovacoes"
            icon={CheckCircle2Icon}
            title="Aprovações"
            sub="Revisar afastamentos pendentes"
            tone="primary"
            count={pendentes}
          />
          <QuickAction
            href="/afastamentos"
            icon={ListChecksIcon}
            title="Afastamentos"
            sub="Lista completa"
            tone="accent"
          />
          <QuickAction
            href="/ocorrencias"
            icon={AlertTriangleIcon}
            title="Ocorrências"
            sub="Aberturas e investigações"
            tone="accent"
          />
          <QuickAction
            href="/forms/afastamentos"
            icon={FileEditIcon}
            title="Novo afastamento"
            sub="Formulário público"
            tone="accent"
          />
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="Afastamentos ativos"
              value={ativos}
              delta={ativos === 0 ? "—" : `${ativos} em curso`}
              tone="primary"
            />
            <KpiCard
              label="Ocorrências abertas"
              value={ocorrenciasAbertas}
              delta={ocorrenciasAbertas === 0 ? "—" : `${ocorrenciasAbertas} aguardando investigação`}
              tone="accent"
            />
          </div>
          <ActivityFeed rows={recentes} seeAllHref="/afastamentos" />
        </div>
      </div>
    </div>
  );
}
