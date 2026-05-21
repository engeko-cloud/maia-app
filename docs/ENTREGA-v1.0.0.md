---
title: Termo de Entrega — MAIA ENGEKO v1.0.0
subtitle: Sistema de Saúde Ocupacional e Segurança do Trabalho
doc_type: Termo de Entrega
version: 1.0.0
date: 2026-05-19
client: ENGEKO ENGENHARIA E CONSTRUÇÃO LTDA.
back_cover: true
language: pt-BR
---

# Termo de Entrega — MAIA ENGEKO v1.0.0

**Sistema de Saúde Ocupacional e Segurança do Trabalho**

---

## 1. Identificação das partes

### Fornecedor

**Razão social:** HEIZEN TECNOLOGIA LTDA.
**Nome comercial:** Fapptory — The App Factory
**CNPJ:** 47.624.793/0001-83
**Endereço:** Av. Brig. Faria Lima, 1811, Sala 1119 — Vila Olímpia — São Paulo/SP
**Representado por:** Lucas Telles Ribeiro Cotrim - CPF: 352.639.218-88

### Cliente

**Razão social:** ENGEKO ENGENHARIA E CONSTRUÇÃO LTDA.
**Nome comercial:** Engeko Engenharia
**CNPJ:** 08.726.496/0001-97
**Endereço:** Rua França Pinto, 1347 — Vila Mariana — São Paulo/SP
**Representado por:** Caique Lobo de Souza - CPF: 519.711.828-85

---

## 2. Objeto da entrega

Entrega final, em **versão 1.0.0**, do sistema **MAIA** — plataforma web _single-tenant_ de gestão de **afastamentos de colaboradores** e **ocorrências de segurança do trabalho**, desenvolvida sob medida para a ENGEKO.

O sistema é composto por dois repositórios independentes:

| Repositório | Conteúdo | Status |
| ----------- | -------- | ------ |
| `maia-db`   | Banco de dados Supabase (Postgres + RLS + Storage) e _edge functions_ (Deno) para integrações SOC e Fluig | Entregue, em produção |
| `maia-app`  | Aplicação frontend Next.js 16 (App Router), incluindo painéis internos, formulários públicos, portal do colaborador, API interna e _templates_ de e-mail | Entregue, em produção |

Ambos os repositórios já se encontram **transferidos para a organização GitHub do cliente**, sob sua titularidade e controle exclusivos a partir desta entrega.

---

## 3. Funcionalidades e capacidades entregues

### 3.1 Fluxos públicos (sem login)

- **Formulário público de afastamento** (`/forms/afastamentos`) com:
  - Consulta automática de CPF na base **Sistema SOC**, com preenchimento automático de nome, setor, cargo e códigos de empresa/unidade.
  - Validação de campos por _schema_ (Zod) — CPF, e-mail, datas, duração, registro do emissor (CRM/CRO).
  - Upload de anexo (atestado/laudo), aceitando PDF, JPG, PNG, WebP — limite de 10 MB por arquivo.
  - Suporte aos **12 tipos de afastamento** previstos: doença, acidente de trabalho, consulta médica, doação de sangue, realização de exames, Previdência (31 e 91 dias), casamento, óbito, maternidade, paternidade e demais previstos pela CLT.
- **Formulário público de ocorrência** (`/forms/ocorrencias`) para registro inicial de incidentes de segurança no trabalho.
- **Link público estável de reenvio** (`/afastamentos/editar/[token]`) — quando um afastamento é rejeitado pela Saúde Ocupacional, o autor recebe um link único, sem necessidade de login, para corrigir e reenviar a submissão (modelo Calendly/DocuSign).
- **Página pública de status** (`/afastamentos/status`, `/ocorrencias/status`) — consulta de andamento por protocolo.
- **Link público estável de investigação** (`/investigacoes/editar/[token]`) — quando uma ocorrência é gerada, o autor recebe um link único, sem necessidade de login, para preencher e enviar o relatório de investigação de ocorrências (modelo Calendly/DocuSign).
- **Relatórios públicos de ocorrência** — geração de PDF acessível por link único para envio externo.

### 3.2 Portal do colaborador

- **Cadastro e login do colaborador** via _OTP_ por e-mail (sem senha), com verificação de email.
- **Painel pessoal** mostrando o histórico das próprias submissões (afastamentos).
- **Acompanhamento de situação** em tempo real, com timeline de eventos.

### 3.3 Área interna — Saúde Ocupacional

- **Painel inicial** com contadores de pendências e itens recentes.
- **Inbox de aprovações** (`/afastamentos/aprovacoes`) — interface redimensionável (lista + detalhe + ações), priorizada por data.
- **Aprovação de afastamentos médicos**, com:
  - Validação de transição de estado (`pendente → finalizado`).
  - **Push automático ao Fluig (TOTVS)** em duas etapas: upload do anexo (`createSimpleDocument`) e abertura do processo `wkfIntegraAtestado` (`startProcess`).
  - Disparo de e-mails para o autor e para a folha de pagamento.
- **Rejeição com motivo obrigatório** e envio do link de reenvio ao colaborador.
- **Cancelamento administrativo** (admin _only_), preservando trilha de auditoria.
- **Listagem com filtros** por situação, tipo, empresa, unidade, CPF, período e busca textual.
- **Detalhe de afastamento** com _timeline_ completa de eventos (criação, aprovação, e-mails enviados, push Fluig, etc.).

### 3.4 Área interna — Segurança do Trabalho

- **Listagem e detalhe de ocorrências** com filtros e situação operacional.
- **Formulário de investigação Ishikawa completo** — diagrama dos **6 Ms** (Mão de obra, Método, Máquina, Material, Medida, Meio ambiente), **3 graus** de severidade e **83 causas** pré-curadas (editáveis pela administração), com possibilidade de causas livres.
- **Plano de ação** com itens, responsáveis e status (`pendente`, `em_andamento`, `concluida`, `cancelada`).
- **Anexos de fotos** ao processo de investigação, com upload privado e _preview_ por URL assinada.
- **Fluxo de aprovação** da investigação com _state machine_ explícita (`em_andamento → em_aprovacao → aprovada / rejeitada / cancelada`) — incluindo reabertura e motivo obrigatório de rejeição.
- **Edição pública de investigação por token** para envio a peritos externos (modelo Calendly/DocuSign).
- **Relatório PDF** da investigação, gerado server-side e acessível por link público.

### 3.5 Administração

- **CRUD de usuários** — convite por e-mail (`inviteUserByEmail`), toggle de admin/ativo, renomeação e **exclusão completa** (remove tanto a linha em `usuarios` quanto a conta em `auth.users`, liberando o e-mail para reinvite).
- **Gestão de equipes** (`oh` — Saúde Ocupacional / `safety` — Segurança), com adição e remoção de membros.
- **CRUD de empresas**, com vinculação aos códigos SOC e Fluig.
- **CRUD de unidades**.
- **CRUD de tipos de afastamento**, com controle do campo "requer aprovação" e ordem de exibição.
- **CRUD da taxonomia Ishikawa** — categorias (6 Ms), graus de severidade e biblioteca de causas, todos editáveis pela administração.
- **Consulta de colaboradores por CPF** — visualização do cadastro e do histórico de submissões.
- **Configurações globais** — e-mail da folha de pagamento, _thresholds_ operacionais (SLA de aprovação).

### 3.6 Relatórios e operação

- **Exportação CSV** de afastamentos e ocorrências, respeitando os mesmos filtros da tela.
- **Painel de saúde da operação** (`/api/saude`) com:
  - Quantidade de e-mails que falharam (últimas 24 h).
  - _Pushes_ Fluig que falharam, com detalhe do erro retornado pela _edge function_ e botão para **retentar manualmente** o envio.
  - Latência _p50_ e _p95_ de aprovação.
  - Distribuição de ocorrências por situação e afastamentos por tipo.
  - Cobertura de anexos.
- **Notificações in-app** para usuários autenticados — sino com _badge_ no topo da navegação, com leitura individual rastreada em `eventos_lidos`.
- **Comentários internos** em afastamentos, com suporte a anexos — _thread_ entre os membros da equipe de Saúde Ocupacional.
- **Perfil do usuário** — edição de nome, troca de senha e upload de foto de perfil (avatar).

### 3.7 Integrações externas

| Integração | Protocolo | Função |
| ---------- | --------- | ------ |
| **SOC** | HTTP (`ws1.soc.com.br/WebSoc/exportadados`), resposta ISO-8859-1 | Consulta cadastral de colaborador por CPF |
| **Fluig (TOTVS)** | SOAP em duas etapas (ECMDocumentService + ECMWorkflowEngineService) | Encaminhamento de atestados médicos aprovados para o workflow de folha |
| **Resend** | API REST v6 | Envio transacional de todos os e-mails do sistema |
| **Supabase Auth** | JWT + cookies SSR | Identidade, sessões, _invites_ e recuperação de senha |
| **Supabase Storage** | Bucket privado `attachments` | Armazenamento de anexos com URLs assinadas |
| **Puppeteer + @sparticuz/chromium** | Chromium _serverless_ executado no _runtime_ Vercel | Renderização _server-side_ de relatórios PDF de ocorrência/investigação |

### 3.8 E-mails transacionais

**Quatorze** _templates_ HTML responsivos e _inline-styled_ (compatíveis com qualquer cliente) despachados via Resend a partir do `maia-app`, mais **dois** aplicados nos _templates_ do Supabase Auth (totalizando dezesseis):

**Afastamentos:**
- `afastamento-receipt` — recibo ao autor
- `afastamento-approved` — aprovação ao autor
- `afastamento-rejected` — rejeição com link de reenvio
- `folha-auto-accept` — notificação à folha (tipos sem aprovação)
- `folha-approved-medical` — notificação à folha (aprovação médica)

**Ocorrências e investigações:**
- `ocorrencia-receipt` — recibo de ocorrência ao autor
- `ocorrencia-nova-para-safety` — notificação à equipe de Segurança quando uma nova ocorrência é registrada
- `investigacao-em-aprovacao` — notificação à equipe responsável quando uma investigação é submetida para aprovação
- `investigacao-aprovada` — notificação à equipe de Segurança e ao autor após aprovação
- `investigacao-rejeitada` — notificação com motivo da rejeição

**Portal e autenticação:**
- `portal-otp` — código OTP de 6 dígitos para o colaborador
- `magic-link` — link de acesso alternativo para staff
- `user-invite` * — _template_ aplicado no Supabase Auth
- `password-reset` * — _template_ aplicado no Supabase Auth

\* Aplicados em **Supabase Dashboard → Authentication → Email Templates**; o envio é feito pelo próprio Supabase quando `inviteUserByEmail` ou `resetPasswordForEmail` é chamado.

### 3.9 Segurança e auditoria

- **RLS (Row Level Security)** ativado em todas as **20 tabelas** do banco como última linha de defesa.
- **Service-role isolado no servidor** — nunca exposto ao navegador.
- **Padrão de gating**: identificação → checagem de permissão → uso do _admin client_.
- **Subsistema de autenticação do portal do colaborador isolado** — o portal usa cookie próprio (`portal_session`, 7 dias, _HttpOnly_) e tabelas dedicadas (`colaboradores`, `portal_otp_codes`, `portal_sessions`), **sem qualquer acoplamento com `auth.users`**. Dados pessoais (CPF, e-mail, OTPs) ficam isolados por RLS em modo _service-role-only_.
- **Tabela `eventos`** registra toda mutação relevante (criação, aprovação, rejeição, reenvio, cancelamento, push Fluig, e-mails, edição, eventos de investigação) — trilha de auditoria unificada e imutável. Tabela acessória `eventos_lidos` rastreia _read-receipts_ por usuário (notificações in-app).
- **CHECK constraints** no banco para todas as _state machines_ (afastamento, ocorrência, investigação, plano de ação); validação dupla em código (`lib/afastamento-state.ts`, `lib/ocorrencia-state.ts`, `lib/investigacao-state.ts`).

---

## 4. Documentação técnica entregue

A documentação técnica detalhada (arquitetura, modelo de dados, fluxos com diagramas, autenticação, autorização, integrações, rotas, _endpoints_, _design system_, convenções, deploy e _troubleshooting_) está integralmente disponível no repositório `maia-app`, no arquivo:

```
docs/DOCUMENTACAO.md
```

São aproximadamente 1 370 linhas cobrindo todas as decisões de projeto, _trade-offs_ e procedimentos operacionais.

---

## 5. Cobertura de testes

| Camada | Ferramenta | Quantidade |
| ------ | ---------- | ---------- |
| Unitários | Vitest | **35 arquivos de teste** cobrindo: permissões, validações Zod, _state machines_, formatação de eventos, geração de CSV, autenticação, _dashboard queries_, tokens de edição, navegação, formulários, gates de investigação, _portal session_, migração de dados legados, entre outros |
| End-to-end | Playwright | **5 cenários** cobrindo: _happy path_ (submissão → aprovação), páginas de autenticação, painel, landing pública e fluxo da equipe de Saúde |
| RLS | psql _smoke test_ | Verificação de visibilidade entre admin, equipe `oh` e usuário comum |
| Edge functions | Deno test | Mapeamento SOC ↔ Fluig de tipos médicos |

Toda a base foi adicionalmente **testada manualmente** ponta-a-ponta nos ambientes de _staging_ e produção, incluindo as integrações com SOC, Fluig e Resend.

Comandos:

```bash
npx vitest run        # unitários
npx playwright test   # E2E (requer variáveis E2E_*)
```

---

## 6. Versão e _release_

- **Versão entregue:** **v1.0.0**
- **Data de entrega:** 19 de maio de 2026
- **Repositórios na titularidade do cliente:** sim, ambos (`maia-db` e `maia-app`)
- **Ambientes em produção:** Supabase Cloud + Vercel + Resend, sob credenciais da ENGEKO

---

## 7. Licença de uso

Mediante o pagamento integral da Nota Fiscal descrita na Seção 9, a HEIZEN TECNOLOGIA LTDA. (Fapptory) concede à ENGEKO os seguintes direitos sobre o sistema MAIA na versão 1.0.0:

### 7.1 Direitos concedidos

- **Uso interno irrestrito** do sistema MAIA pela ENGEKO, em caráter vitalício, para suas próprias operações de saúde ocupacional e segurança do trabalho.
- **Titularidade plena do código-fonte** entregue nos repositórios `maia-db` e `maia-app`, incluindo o direito de **modificar**, **adaptar**, **estender** e **manter** o sistema conforme suas necessidades internas.
- **Titularidade plena dos dados** gerados, armazenados e processados pelo sistema.

### 7.2 Restrições

- **Vedada a comercialização**, sublicenciamento, revenda, distribuição pública, oferta como serviço (SaaS) a terceiros, ou qualquer forma de exploração comercial do sistema MAIA para entidades externas à ENGEKO.
- O sistema é entregue **para uso interno corporativo da ENGEKO**. Caso surja interesse em qualquer modalidade de exploração comercial, uma licença comercial específica deverá ser negociada em separado com a Fapptory.

### 7.3 Responsabilidade após a entrega

- A partir desta entrega, **toda e qualquer alteração** realizada no código-fonte, no banco de dados, nas configurações de produção, nas integrações ou na infraestrutura do sistema é de **inteira e exclusiva responsabilidade da ENGEKO**.
- A Fapptory **não responde** por: defeitos, _bugs_, falhas operacionais, perdas de dados, indisponibilidades, vulnerabilidades de segurança ou qualquer outro evento adverso decorrente de modificações realizadas após esta entrega — independentemente de quem as tenha executado (equipe interna da ENGEKO, terceiros contratados ou outros fornecedores).
- **Recomendação**: caso a ENGEKO opte por contratar outros desenvolvedores ou fornecedores para evolução, manutenção ou modificação do sistema, **esta prática não é recomendada pela Fapptory**, que não se responsabilizará por qualquer impacto técnico, operacional ou comercial decorrente. A Fapptory mantém-se disponível para um eventual contrato futuro de desenvolvimento ou evolução, a ser negociado em separado.

### 7.4 Garantia

Esta entrega é fornecida na modalidade **"as-is"** (no estado em que se encontra), tendo sido validada por testes automatizados e manuais conforme descrito na Seção 5. Não há garantia estendida, SLA ou compromisso de manutenção corretiva ou evolutiva incluído nesta entrega.

---

## 8. Migrações e operações de dados pós-entrega

Após a entrega do sistema, foram realizadas operações de **migração de dados do sistema legado (mix de multiplas plataformas que evoluíram ao longo do tempo)** para garantir a integridade e acessibilidade dos registros históricos. Essas operações incluíram:

- Migração de ~16.000 registros de afastamentos com `arquivo_url` armazenado como URL externa completa para o padrão de caminho relativo no bucket `attachments` do Supabase atual.
- Recuperação de anexos a partir de múltiplas origens: ClickUp, Fillout, bucket legado Supabase e arquivos de backup local.
- **~10.400 anexos recuperados** e migrados com sucesso. Um total de ~3.024 arquivos foram identificados como irrecuperáveis (links expirados sem backup disponível), situação aceita em casos de migrações repetitivas entre diferentes plataformas ao longo de anos.

O detalhamento técnico completo dessas operações — incluindo scripts utilizados, fases de execução, critérios de decisão e justificativa para os registros irrecuperáveis — está documentado no repositório `maia-app` no GitHub do `engeko-cloud`, em`/docs/DOCUMENTACAO.md`  →  Seção 18: Migração de anexos legados (2026-05)

Essas atividades foram executadas **após** o encerramento formal do escopo de desenvolvimento v1.0.0 e não alteram o objeto contratual descrito nas seções anteriores.

---

## 10. Itens **não incluídos** nesta entrega

Para clareza contratual, ficam explicitamente fora do escopo desta entrega:

- Suporte técnico contínuo, _hotline_ ou plantão.
- Manutenção corretiva ou evolutiva.
- Treinamento de usuários ou administradores.
- Migração de dados de sistemas legados.
- Configuração ou contratação de infraestrutura (Supabase, Vercel, Resend, domínio, certificados).
- Personalizações adicionais, novos fluxos ou novas integrações.
- Itens do _backlog_ documentado em `docs/DOCUMENTACAO.md` (Seção 17), tais como: alterações no formulário Ishikawa completo, CID-10 completo, _rate limiting_, antivírus em anexos, retry automático do Fluig, OAuth providers, PWA, dashboards adicionais, etc.

Qualquer item da lista acima, se necessário, deverá ser objeto de **proposta e contrato em separado**.

---

## 11. Nota Fiscal e condições financeiras

| Descrição | Valor |
| --------- | ----: |
| Desenvolvimento e entrega do sistema **MAIA ENGEKO v1.0.0** — escopo completo descrito nas Seções 2 e 3 deste termo | **R$ 8.000,00** |
| **Total** | **R$ 8.000,00** |

- **Forma de cobrança:** Nota Fiscal de Serviço emitida pela HEIZEN TECNOLOGIA LTDA. (CNPJ 47.624.793/0001-83).
- **Suporte pós-entrega:** **não incluído** nesta cobrança. Eventual contratação de suporte ou evolução será objeto de proposta separada.
- **Tributação:** conforme regime fiscal vigente.

---

## 12. Aceitação e encerramento

Mediante a assinatura deste termo pelas partes, fica formalizado:

1. A entrega completa do sistema **MAIA ENGEKO v1.0.0**, conforme escopo descrito nas Seções 2 e 3.
2. A transferência da titularidade dos repositórios `maia-db` e `maia-app` para a ENGEKO.
3. A concessão da licença de uso descrita na Seção 7.
4. O encerramento do contrato de desenvolvimento entre as partes, ressalvada a cobrança formalizada na Seção 9.
5. O reconhecimento pelo cliente de que itens listados na Seção 8 não foram contratados nem entregues nesta etapa.

---

\newpage

## 13. Assinaturas

**São Paulo, 20 de Maio de 2026.**


| **Pela Fapptory (HEIZEN TECNOLOGIA LTDA.)** | **Pela ENGEKO** |
| --- | --- |
| &nbsp; | &nbsp; |
| _____________________________________ | _____________________________________ |
| Nome: | Nome: |
| Cargo: | Cargo: |
| CPF: | CPF: |


---

_Documento gerado em 20 de maio de 2026 — versão final para assinatura._
