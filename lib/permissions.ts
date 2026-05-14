export type Me = {
  id: string;
  administrador: boolean;
  equipes: string[];
};

export function isAdmin(me: Me | null | undefined): boolean {
  return !!me?.administrador;
}

export function isInEquipe(me: Me | null | undefined, codigo: string): boolean {
  if (!me) return false;
  if (me.administrador) return true;
  return me.equipes.includes(codigo);
}
