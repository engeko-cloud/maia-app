export interface AppNavItem {
  label: string;
  href: string;
  icon?: string;
}

export interface AppNavGroup {
  id: "painel" | "afastamentos" | "ocorrencias" | "admin";
  label: string;
  href: string;
  items: AppNavItem[];
  adminOnly?: boolean;
  requiredEquipe?: "oh" | "safety";
}

export const appNav: AppNavGroup[] = [
  {
    id: "painel",
    label: "Painel",
    href: "/app/painel",
    items: [],
  },
  {
    id: "afastamentos",
    label: "Afastamentos",
    href: "/app/afastamentos",
    requiredEquipe: "oh",
    items: [
      { label: "Lista",      href: "/app/afastamentos" },
      { label: "Aprovações", href: "/app/afastamentos/aprovacoes" },
    ],
  },
  {
    id: "ocorrencias",
    label: "Ocorrências",
    href: "/app/ocorrencias",
    requiredEquipe: "safety",
    items: [
      { label: "Lista",         href: "/app/ocorrencias" },
      { label: "Investigações", href: "/app/ocorrencias" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    href: "/app/admin",
    adminOnly: true,
    items: [],
  },
];
