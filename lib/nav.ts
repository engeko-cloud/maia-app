/**
 * Private top-nav config. Phase 4 builds the AppTopNav component that
 * consumes this. Admin groups are filtered out for non-admin users.
 */

export interface AppNavItem {
  label: string;
  href: string;
  /** lucide-react icon name (optional — submenu items typically don't show icons) */
  icon?: string;
}

export interface AppNavGroup {
  /** Stable identifier (used for active-tab detection and tests). */
  id: "painel" | "afastamentos" | "ocorrencias" | "admin";
  /** Display label in the top-nav. */
  label: string;
  /** Root route for the group. Painel uses this as the link target directly; others use it for active-state matching. */
  href: string;
  /** Submenu items. Empty array for groups without a dropdown (Painel). */
  items: AppNavItem[];
  /** When true, the group is hidden from non-admin users. */
  adminOnly?: boolean;
}

export const appNav: AppNavGroup[] = [
  {
    id: "painel",
    label: "Painel",
    href: "/painel",
    items: [],
  },
  {
    id: "afastamentos",
    label: "Afastamentos",
    href: "/afastamentos",
    items: [
      { label: "Lista", href: "/afastamentos" },
      { label: "Aprovações", href: "/afastamentos/aprovacoes" },
    ],
  },
  {
    id: "ocorrencias",
    label: "Ocorrências",
    href: "/ocorrencias",
    items: [
      { label: "Lista", href: "/ocorrencias" },
      { label: "Nova",  href: "/forms/ocorrencias" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    adminOnly: true,
    items: [
      { label: "Empresas",                   href: "/admin/empresas" },
      { label: "Unidades",                   href: "/admin/unidades" },
      { label: "Equipes",                    href: "/admin/equipes" },
      { label: "Usuários",                   href: "/admin/usuarios" },
      { label: "Tipos de afastamento",       href: "/admin/afastamento-tipos" },
      { label: "Categorias de investigação", href: "/admin/investigacao/categorias" },
      { label: "Graus de severidade",        href: "/admin/investigacao/graus" },
      { label: "Causas de investigação",     href: "/admin/investigacao/causas" },
      { label: "Configurações",              href: "/admin/configuracoes" },
    ],
  },
];
