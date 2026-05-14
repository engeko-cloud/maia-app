/**
 * Public linktree config for the landing page at `/`.
 *
 * Internal items are routes inside maia-app (must start with `/`).
 * External items open in a new tab (must be absolute http(s) URLs).
 */

export type PublicLinkType = "internal" | "external";

export interface PublicLinkItem {
  title: string;
  description: string;
  url: string;
  /** lucide-react icon name, e.g. "file-text", "siren" */
  icon: string;
  type: PublicLinkType;
}

export interface PublicLinkGroup {
  title: string;
  items: PublicLinkItem[];
}

export const publicLinks: PublicLinkGroup[] = [
  {
    title: "Formulários",
    items: [
      {
        title: "Atestados e Declarações",
        description: "Entregar atestado médico, declaração ou comprovante de internação.",
        url: "/forms/afastamentos",
        icon: "file-text",
        type: "internal",
      },
      {
        title: "Comunicação de Ocorrências",
        description: "Registrar uma ocorrência de segurança do trabalho.",
        url: "/forms/ocorrencias",
        icon: "siren",
        type: "internal",
      },
    ],
  },
  {
    title: "Sistemas Externos",
    items: [
      {
        title: "SOC",
        description: "Sistema de saúde ocupacional — sistema.soc.com.br",
        url: "https://sistema.soc.com.br/WebSoc/",
        icon: "external-link",
        type: "external",
      },
      {
        title: "Obrasoft",
        description: "Gestão de obras — obrasoft.com.br",
        url: "https://www.obrasoft.com.br/Acesso/login.aspx",
        icon: "external-link",
        type: "external",
      },
      {
        title: "GreenLegis",
        description: "Compliance regulatório — greenlegis.com.br",
        url: "https://sistema.greenlegis.com.br/login",
        icon: "external-link",
        type: "external",
      },
    ],
  },
];
