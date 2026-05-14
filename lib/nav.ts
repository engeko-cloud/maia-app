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
  // TODO (Phase 5): add "Novo" submenu under afastamentos and
  // "Investigações" + "Nova" under ocorrencias once their routes exist.
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
    ],
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    adminOnly: true,
    items: [
      { label: "Empresas", href: "/admin/empresas" },
      { label: "Unidades", href: "/admin/unidades" },
      { label: "Equipes", href: "/admin/equipes" },
      { label: "Usuários", href: "/admin/usuarios" },
      { label: "Tipos de afastamento", href: "/admin/afastamento-tipos" },
      { label: "Configurações", href: "/admin/configuracoes" },
    ],
  },
];
