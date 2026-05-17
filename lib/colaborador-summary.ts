import type { SocColaborador } from "@/lib/soc";

export type ColaboradorDisplayData = {
  nome: string;
  cargo: string | null;
  setor: string | null;
  unidade_nome: string | null;
  codigo_soc: string | null;
};

export type ColaboradorFallback = {
  nome: string | null;
  cargo: string | null;
  setor: string | null;
  unidade_nome: string | null;
};

export function resolveColaboradorData(
  soc: Pick<SocColaborador, "nome" | "cargo" | "setor" | "unidade_nome" | "codigo_soc"> | null,
  fallback: ColaboradorFallback,
): ColaboradorDisplayData {
  return {
    nome: soc?.nome ?? fallback.nome ?? "",
    cargo: soc?.cargo ?? fallback.cargo ?? null,
    setor: soc?.setor ?? fallback.setor ?? null,
    unidade_nome: soc?.unidade_nome ?? fallback.unidade_nome ?? null,
    codigo_soc: soc?.codigo_soc ?? null,
  };
}
