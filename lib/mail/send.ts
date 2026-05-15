import { Resend } from "resend";
import { afastamentoReceipt, type AfastamentoEmail } from "@/emails/afastamento-receipt";
import { afastamentoRejected } from "@/emails/afastamento-rejected";
import { afastamentoApproved } from "@/emails/afastamento-approved";
import { folhaAutoAccept } from "@/emails/folha-auto-accept";
import { folhaApprovedMedical } from "@/emails/folha-approved-medical";
import { ocorrenciaReceipt, type OcorrenciaEmail } from "@/emails/ocorrencia-receipt";
import { ocorrenciaNovaParaSafety, type OcorrenciaParaSafetyEmail } from "@/emails/ocorrencia-nova-para-safety";
import { portalOtp } from "@/emails/portal-otp";

// Identificador humano para o subject: usa serial_id quando disponível,
// senão omite. Email subject é o principal canal de "tracking" para o autor.
function tagId(id: number | null | undefined): string {
  return id != null ? ` #${id}` : "";
}

// Registro de templates. Subject pode ser função de data para incluir
// o identificador serial_id no assunto.
const TEMPLATES = {
  "afastamento-receipt": {
    subject: (data: { a: AfastamentoEmail }) => `Recebemos seu afastamento${tagId(data.a.serial_id)}`,
    render:  afastamentoReceipt,
  },
  "afastamento-rejected": {
    subject: (data: { a: AfastamentoEmail }) => `Afastamento${tagId(data.a.serial_id)} rejeitado — ação necessária`,
    render:  afastamentoRejected,
  },
  "afastamento-approved": {
    subject: (data: { a: AfastamentoEmail }) => `Afastamento${tagId(data.a.serial_id)} aprovado`,
    render:  afastamentoApproved,
  },
  "folha-auto-accept": {
    subject: (data: { a: AfastamentoEmail }) => `Novo afastamento${tagId(data.a.serial_id)} (não-médico)`,
    render:  folhaAutoAccept,
  },
  "folha-approved-medical": {
    subject: (data: { a: AfastamentoEmail }) => `Afastamento médico${tagId(data.a.serial_id)} aprovado`,
    render:  folhaApprovedMedical,
  },
  "ocorrencia-receipt": {
    subject: (data: { o: OcorrenciaEmail }) => `Recebemos sua ocorrência${tagId(data.o.serial_id)}`,
    render:  ocorrenciaReceipt,
  },
  "ocorrencia-nova-para-safety": {
    subject: (data: { o: OcorrenciaParaSafetyEmail }) => `Nova ocorrência${tagId(data.o.serial_id)} — investigação pendente`,
    render:  ocorrenciaNovaParaSafety,
  },
  "portal-otp": {
    subject: () => "Seu código de acesso — MAIA",
    render:  (data: { code: string }) => portalOtp(data),
  },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

export async function sendMail(opts: { template: TemplateKey; to: string | string[]; data: any }) {
  const t = TEMPLATES[opts.template];
  const subject = (t.subject as (d: any) => string)(opts.data);
  const html = (t.render as (d: any) => string)(opts.data);
  const resend = new Resend(process.env.RESEND_TEST_API_KEY!);
  const from   = "Maia <maia@fapptory.me>";
  const { error } = await resend.emails.send({ from, to: opts.to, subject, html });
  if (error) throw new Error(error.message);
}
