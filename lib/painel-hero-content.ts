export interface HeroCta {
  href: string;
  label: string;
}

export interface HeroContent {
  headline: string;
  sub: string;
  ctas: HeroCta[];
}

interface BuildHeroContentOpts {
  isAdmin: boolean;
  showOh: boolean;
  showSafety: boolean;
  pendentes: number;
  investigacoesPendentes: number;
}

const pluralAprovacoes = (n: number) =>
  n === 1 ? "1 aprovação" : `${n} aprovações`;

const pluralInvestigacoes = (n: number) =>
  n === 1 ? "1 investigação" : `${n} investigações`;

const ALL_CLEAR: HeroContent = {
  headline: "Nada pendente — tudo em dia.",
  sub: "Acompanhe os registros ativos pelos cartões abaixo.",
  ctas: [],
};

export function buildHeroContent({
  isAdmin,
  showOh,
  showSafety,
  pendentes,
  investigacoesPendentes,
}: BuildHeroContentOpts): HeroContent {
  const combined = isAdmin || (showOh && showSafety);

  if (combined) {
    const hasPendentes = pendentes > 0;
    const hasInv = investigacoesPendentes > 0;

    if (hasPendentes && hasInv) {
      return {
        headline: `${pluralAprovacoes(pendentes)} e ${pluralInvestigacoes(investigacoesPendentes)} aguardando revisão.`,
        sub: "Revise as aprovações e investigações pendentes para manter o fluxo.",
        ctas: [
          { href: "/app/afastamentos/aprovacoes", label: "Ver aprovações" },
          { href: "/app/investigacoes", label: "Ver investigações" },
        ],
      };
    }
    if (hasPendentes) {
      return {
        headline: `${pluralAprovacoes(pendentes)} aguardando sua revisão.`,
        sub: "Revise as solicitações pendentes antes do fim do dia para manter o fluxo.",
        ctas: [{ href: "/app/afastamentos/aprovacoes", label: "Ver aprovações" }],
      };
    }
    if (hasInv) {
      return {
        headline: `${pluralInvestigacoes(investigacoesPendentes)} aguardando conclusão.`,
        sub: "Acesse as investigações abertas e conclua as pendentes.",
        ctas: [{ href: "/app/investigacoes", label: "Ver investigações" }],
      };
    }
    return ALL_CLEAR;
  }

  if (showOh) {
    if (pendentes > 0) {
      return {
        headline: `${pluralAprovacoes(pendentes)} aguardando sua revisão.`,
        sub: "Revise as solicitações pendentes antes do fim do dia para manter o fluxo.",
        ctas: [{ href: "/app/afastamentos/aprovacoes", label: "Ver aprovações" }],
      };
    }
    return ALL_CLEAR;
  }

  if (showSafety) {
    if (investigacoesPendentes > 0) {
      return {
        headline: `${pluralInvestigacoes(investigacoesPendentes)} aguardando conclusão.`,
        sub: "Acesse as investigações abertas e conclua as pendentes.",
        ctas: [{ href: "/app/investigacoes", label: "Ver investigações" }],
      };
    }
    return ALL_CLEAR;
  }

  return ALL_CLEAR;
}
