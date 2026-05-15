import { publicLinks } from "@/lib/public-links";

export interface PublicNavItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface PublicNavGroup {
  id: "inicio" | "formularios" | "sistemas";
  label: string;
  /** Direct nav target when `items` is empty (Início → "/"); ignored otherwise. */
  href: string;
  items: PublicNavItem[];
}

function deriveItems(groupTitle: string, external: boolean): PublicNavItem[] {
  const src = publicLinks.find((g) => g.title === groupTitle);
  if (!src) return [];
  return src.items.map((i) => ({
    label: i.title,
    href: i.url,
    ...(external ? { external: true } : {}),
  }));
}

export const publicNav: PublicNavGroup[] = [
  { id: "inicio", label: "Início", href: "/", items: [] },
  {
    id: "formularios",
    label: "Formulários",
    href: "/forms",
    items: deriveItems("Formulários", false),
  },
  {
    id: "sistemas",
    label: "Sistemas",
    href: "#",
    items: deriveItems("Sistemas Externos", true),
  },
];
