import { Resend } from "resend";
import { afastamentoReceipt, type AfastamentoEmail } from "@/emails/afastamento-receipt";
import { afastamentoRejected } from "@/emails/afastamento-rejected";
import { afastamentoApproved } from "@/emails/afastamento-approved";
import { folhaAutoAccept } from "@/emails/folha-auto-accept";
import { folhaApprovedMedical } from "@/emails/folha-approved-medical";
import { ocorrenciaReceipt, type OcorrenciaEmail } from "@/emails/ocorrencia-receipt";
import { ocorrenciaNovaParaSafety, type OcorrenciaParaSafetyEmail } from "@/emails/ocorrencia-nova-para-safety";
import { portalOtp } from "@/emails/portal-otp";
import { userInvite, type UserInviteEmail } from "@/emails/user-invite";
import { investigacaoEmAprovacao, type InvestigacaoEmAprovacaoEmail } from "@/emails/investigacao-em-aprovacao";
import { investigacaoAprovada, type InvestigacaoAprovadaEmail } from "@/emails/investigacao-aprovada";
import { investigacaoRejeitada, type InvestigacaoRejeitadaEmail } from "@/emails/investigacao-rejeitada";
import { passwordReset, type PasswordResetEmail } from "@/emails/password-reset";
import { magicLink, type MagicLinkEmail } from "@/emails/magic-link";

// Identificador humano para o subject: usa serial_id quando disponível,
// senão omite. Email subject é o principal canal de "tracking" para o autor.
function tagId(id: number | null | undefined): string {
  return id != null ? ` #${id}` : "";
}

// Registro de templates. Subject pode ser função de data para incluir
// o identificador serial_id no assunto.
// toUser: true  → recipient is a system user (seed email in dev) — override applies
// toUser: false → recipient is an external worker/contact from form data — no override
const TEMPLATES = {
  "afastamento-receipt": {
    subject: (data: { a: AfastamentoEmail }) => `Recebemos seu afastamento${tagId(data.a.serial_id)}`,
    render:  afastamentoReceipt,
    toUser:  false,
  },
  "afastamento-rejected": {
    subject: (data: { a: AfastamentoEmail }) => `Afastamento${tagId(data.a.serial_id)} rejeitado — ação necessária`,
    render:  afastamentoRejected,
    toUser:  false,
  },
  "afastamento-approved": {
    subject: (data: { a: AfastamentoEmail }) => `Afastamento${tagId(data.a.serial_id)} aprovado`,
    render:  afastamentoApproved,
    toUser:  false,
  },
  "folha-auto-accept": {
    subject: (data: { a: AfastamentoEmail }) => `Novo afastamento${tagId(data.a.serial_id)} (não-médico)`,
    render:  folhaAutoAccept,
    toUser:  true,
  },
  "folha-approved-medical": {
    subject: (data: { a: AfastamentoEmail }) => `Afastamento médico${tagId(data.a.serial_id)} aprovado`,
    render:  folhaApprovedMedical,
    toUser:  true,
  },
  "ocorrencia-receipt": {
    subject: (data: { o: OcorrenciaEmail }) => `Recebemos sua ocorrência${tagId(data.o.serial_id)}`,
    render:  ocorrenciaReceipt,
    toUser:  false,
  },
  "ocorrencia-nova-para-safety": {
    subject: (data: { o: OcorrenciaParaSafetyEmail }) => `Nova ocorrência${tagId(data.o.serial_id)} — investigação pendente`,
    render:  ocorrenciaNovaParaSafety,
    toUser:  true,
  },
  "investigacao-em-aprovacao": {
    subject: (data: { o: InvestigacaoEmAprovacaoEmail }) => `Investigação${tagId(data.o.serial_id)} pronta para aprovação`,
    render:  investigacaoEmAprovacao,
    toUser:  true,
  },
  "investigacao-aprovada": {
    subject: (data: { o: InvestigacaoAprovadaEmail }) => `Investigação${tagId(data.o.serial_id)} concluída`,
    render:  investigacaoAprovada,
    toUser:  true,
  },
  "investigacao-rejeitada": {
    subject: (data: { o: InvestigacaoRejeitadaEmail }) => `Investigação${tagId(data.o.serial_id)} precisa de ajustes`,
    render:  investigacaoRejeitada,
    toUser:  true,
  },
  "portal-otp": {
    subject: () => "Seu código de acesso — MAIA",
    render:  (data: { code: string }) => portalOtp(data),
    toUser:  false,
  },
  "user-invite": {
    subject: () => "Sua conta no MAIA foi criada",
    render:  (data: { u: UserInviteEmail }) => userInvite(data),
    toUser:  true,
  },
  "password-reset": {
    subject: () => "Redefinir sua senha no MAIA",
    render:  (data: { p: PasswordResetEmail }) => passwordReset(data),
    toUser:  true,
  },
  "magic-link": {
    subject: () => "Seu link de acesso ao MAIA",
    render:  (data: { m: MagicLinkEmail }) => magicLink(data),
    toUser:  true,
  },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

// Dev/test email override: when NODE_ENV !== "production" and the template targets
// a system user (toUser: true), route to this inbox — seed users have @seed.local
// addresses that bounce. External contact emails (form data) are sent as-is.
const DEV_RECIPIENT = "dev-tests@fapptory.me";

export async function sendMail(opts: { template: TemplateKey; to: string | string[]; data: any }) {
  const t = TEMPLATES[opts.template];
  const subject = (t.subject as (d: any) => string)(opts.data);
  const html = (t.render as (d: any) => string)(opts.data);
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const from   = `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`;
  const override = process.env.NODE_ENV !== "production" && t.toUser;
  const realTo = Array.isArray(opts.to) ? opts.to.join(", ") : opts.to;
  const to = override ? DEV_RECIPIENT : opts.to;
  const finalSubject = override ? `[DEV → ${realTo}] ${subject}` : subject;
  const { error } = await resend.emails.send({ from, to, subject: finalSubject, html });
  if (error) throw new Error(error.message);
}
