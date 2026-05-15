import Link from "next/link";
import {
  Building2Icon,
  FactoryIcon,
  UsersIcon,
  UserCogIcon,
  ListTreeIcon,
  SettingsIcon,
  NetworkIcon,
  GaugeIcon,
  ListIcon,
  HeartPulseIcon,
} from "lucide-react";

const ITEMS = [
  {
    href: "/painel/saude",
    title: "Saúde do sistema",
    desc: "Emails e Fluig falhados nas últimas 24h, KPIs operacionais.",
    icon: HeartPulseIcon,
  },
  {
    href: "/admin/usuarios",
    title: "Usuários",
    desc: "Convidar e gerenciar usuários da plataforma.",
    icon: UserCogIcon,
  },
  {
    href: "/admin/equipes",
    title: "Equipes",
    desc: "Atribuir membros às equipes operacionais.",
    icon: UsersIcon,
  },
  {
    href: "/admin/empresas",
    title: "Empresas",
    desc: "Empresas tenantes — código SOC e Fluig.",
    icon: Building2Icon,
  },
  {
    href: "/admin/unidades",
    title: "Unidades",
    desc: "Unidades operacionais por empresa.",
    icon: FactoryIcon,
  },
  {
    href: "/admin/afastamento-tipos",
    title: "Tipos de afastamento",
    desc: "Catálogo de tipos com regras de aprovação.",
    icon: ListTreeIcon,
  },
  {
    href: "/admin/investigacao/categorias",
    title: "Categorias de Ishikawa",
    desc: "Os 6Ms usados na investigação de ocorrências.",
    icon: NetworkIcon,
  },
  {
    href: "/admin/investigacao/graus",
    title: "Graus de severidade",
    desc: "Escala usada para classificar causas na Ishikawa.",
    icon: GaugeIcon,
  },
  {
    href: "/admin/investigacao/causas",
    title: "Causas da Ishikawa",
    desc: "Biblioteca de causas sugeridas por categoria.",
    icon: ListIcon,
  },
  {
    href: "/admin/configuracoes",
    title: "Configurações",
    desc: "Email da folha de pagamentos e integrações.",
    icon: SettingsIcon,
  },
];

export default function AdminHome() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-4">
        <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
          <Link href="/painel" className="hover:text-foreground">
            Painel
          </Link>
          <span className="mx-1 text-[var(--color-fg-subtle)]">/</span>
          <span aria-current="page" className="text-foreground">
            Administração
          </span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Gerencie cadastros e configurações da plataforma.
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="group flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-xs)] transition hover:shadow-[var(--shadow-md)]"
            >
              <span className="grid size-10 place-items-center rounded-md bg-[var(--brand-primary-50)] text-[var(--brand-primary-600)]">
                <i.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-semibold text-foreground">
                  {i.title}
                </span>
                <span className="text-xs text-[var(--color-fg-muted)]">
                  {i.desc}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
