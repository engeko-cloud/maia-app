---
title: Acessos — Plataformas do MAIA
subtitle: Guia rápido para o primeiro login nas plataformas que sustentam o MAIA
doc_type: Guia de Acessos
version: 1.0.0
date: 2026-05-20
client: ENGEKO ENGENHARIA E CONSTRUÇÃO LTDA.
back_cover: true
language: pt-BR
---

# Acessos — Plataformas do MAIA

> Guia rápido para o primeiro login nas plataformas que sustentam o MAIA.
> Em caso de dúvida, contate a Fapptory antes de alterar configurações.

---

## Plataformas

O MAIA depende de quatro serviços externos:

| Plataforma | Finalidade                                                 |
|------------|------------------------------------------------------------|
| GitHub     | Hospedagem do código-fonte (`maia-app` e `maia-db`)        |
| Supabase   | Banco de dados PostgreSQL, autenticação e armazenamento    |
| Vercel     | Hospedagem e deploy do frontend Next.js                    |
| Resend     | Envio dos e-mails transacionais                            |

---

## Credenciais iniciais

**E-mail compartilhado:** `maia.flows@engeko.com.br`
**Senha temporária (GitHub e Supabase):** `Engeko@2026`

> A senha acima é **temporária** e deve ser trocada no primeiro acesso ao
> GitHub e ao Supabase. Vercel e Resend não exigem senha própria — usam
> login via GitHub (OAuth).

---

## 1. GitHub

URL de login: <https://github.com/login>

1. Acesse o link acima.
2. Informe `maia.flows@engeko.com.br` e a senha temporária `Engeko@2026`.
3. Conclua a verificação por e-mail caso solicitada.
4. Em **Settings → Password**, defina uma senha nova e forte.
5. Em **Settings → Password and authentication**, ative a **autenticação em dois fatores (2FA)**. Guarde os códigos de recuperação em local seguro.

---

## 2. Supabase

URL de login: <https://supabase.com/dashboard/sign-in>

1. Acesse o link acima.
2. Informe `maia.flows@engeko.com.br` e a senha temporária `Engeko@2026`.
3. Em **Account → Preferences → Password**, defina uma senha nova.
4. Em **Account → Security**, ative a **autenticação em dois fatores (2FA)**.
5. O projeto **MAIA** aparecerá na lista de projetos da organização.

---

## 3. Vercel (login via GitHub)

URL de login: <https://vercel.com/login>

1. Acesse o link acima.
2. Clique em **Continue with GitHub**.
3. Use a conta GitHub `maia.flows@engeko.com.br` já configurada na etapa 1.
4. Autorize a Vercel a acessar a conta quando solicitado.
5. O projeto **maia-app** aparecerá no dashboard após o login.

---

## 4. Resend (login via GitHub)

URL de login: <https://resend.com/login>

1. Acesse o link acima.
2. Clique em **Continue with GitHub**.
3. Use a mesma conta GitHub configurada na etapa 1.
4. Autorize o Resend a acessar a conta quando solicitado.
5. Os domínios e as chaves de API do MAIA estarão disponíveis no painel.

---

## Boas práticas

- **Nunca compartilhe** a senha por e-mail, chat ou planilhas.
- **Ative 2FA** no GitHub e no Supabase logo após o primeiro acesso — como Vercel e Resend dependem do GitHub, proteger essa conta protege todas as demais.
- Caso suspeite de acesso indevido, troque imediatamente a senha do GitHub e revogue as autorizações OAuth em <https://github.com/settings/applications>.
