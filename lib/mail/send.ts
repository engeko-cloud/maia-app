import { Resend } from "resend";
import { afastamentoReceipt } from "@/emails/afastamento-receipt";
import { afastamentoRejected } from "@/emails/afastamento-rejected";
import { afastamentoApproved } from "@/emails/afastamento-approved";
import { folhaAutoAccept } from "@/emails/folha-auto-accept";
import { folhaApprovedMedical } from "@/emails/folha-approved-medical";
import { ocorrenciaReceipt } from "@/emails/ocorrencia-receipt";
import { ocorrenciaNovaParaSafety } from "@/emails/ocorrencia-nova-para-safety";
import { portalOtp } from "@/emails/portal-otp";

// Registro de templates. Task 22 acrescenta invite + password-reset.
const TEMPLATES = {
  "afastamento-receipt":         { subject: "Recebemos seu afastamento",                            render: afastamentoReceipt },
  "afastamento-rejected":        { subject: "Afastamento rejeitado — ação necessária",              render: afastamentoRejected },
  "afastamento-approved":        { subject: "Afastamento aprovado",                                 render: afastamentoApproved },
  "folha-auto-accept":           { subject: "Novo afastamento (não-médico)",                        render: folhaAutoAccept },
  "folha-approved-medical":      { subject: "Afastamento médico aprovado",                          render: folhaApprovedMedical },
  "ocorrencia-receipt":          { subject: "Recebemos sua ocorrência",                             render: ocorrenciaReceipt },
  "ocorrencia-nova-para-safety": { subject: "Nova ocorrência registrada — investigação pendente",   render: ocorrenciaNovaParaSafety },
  "portal-otp":                  { subject: "Seu código de acesso — MAIA",                          render: (data: { code: string }) => portalOtp(data) },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

export async function sendMail(opts: { template: TemplateKey; to: string | string[]; data: any }) {
  const t = TEMPLATES[opts.template];
  const html = t.render(opts.data);
  const resend = new Resend(process.env.RESEND_TEST_API_KEY!);
  const from   = "Maia <maia@fapptory.me>";
  const { error } = await resend.emails.send({ from, to: opts.to, subject: t.subject, html });
  if (error) throw new Error(error.message);
}
