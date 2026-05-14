/**
 * Top-nav section anchors for the public shell.
 * The landing page (/) renders <section id="..."> for each entry,
 * and the PublicNavLinks component routes through buildHref().
 */

export interface PublicNavSection {
  id: "inicio" | "formularios" | "sistemas";
  label: string;
  anchor: `#${string}`;
}

export const publicNavSections: PublicNavSection[] = [
  { id: "inicio", label: "Início", anchor: "#inicio" },
  { id: "formularios", label: "Formulários", anchor: "#formularios" },
  { id: "sistemas", label: "Sistemas", anchor: "#sistemas" },
];

/**
 * On '/' the anchor is bare so the browser jumps in place.
 * Elsewhere we prefix '/' so the link navigates home first, then jumps.
 */
export function buildHref(pathname: string, anchor: `#${string}`): string {
  return pathname === "/" ? anchor : `/${anchor}`;
}
