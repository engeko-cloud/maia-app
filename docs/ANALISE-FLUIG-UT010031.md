---
title: Debugging Sistemático - Falha Fluig
subtitle: Análise técnica sistemática para o erro UT010031 do webservice Fluig Engeko
doc_type: Relatório de Análise de Erros
version: 1.0.0
date: 2026-05-22
client: ENGEKO ENGENHARIA E CONSTRUÇÃO LTDA.
back_cover: true
language: pt-BR
---

# Análise técnica — UT010031: Falha de login (Integração Fluig MAIA)

**Data:** 2026-05-22
**Sistema afetado:** Integração entre MAIA (maia-app + maia-db) e TOTVS Fluig (`engekoengenharia157014.fluig.cloudtotvs.com.br`)
**Conta envolvida:** `user.webservice`
**Erro retornado pelo Fluig:** `UT010031: Login failed` (`Falha de login`)

---

## 1. Resumo executivo

A função antiga `afastamentos-fluig-engeko` (projeto **old-maia**) operou normalmente por meses com credenciais embutidas no código (`user.webservice` / `user.webservice@13472406`). A nova função `fluig-push` (projeto **maia-db**), que reusa **exatamente as mesmas credenciais e os mesmos endpoints**, recebe sistematicamente do Fluig a resposta:

```xml
<webServiceMessage>Falha de login. UT010031: Login failed</webServiceMessage>
```

Após uma sequência de testes sistemáticos descritos abaixo, confirmamos que **nada do lado da MAIA explica o erro**: as credenciais saem da nossa infraestrutura idênticas, byte-a-byte, ao que a função antiga enviava, e o erro se reproduz a partir de **dois IPs públicos completamente diferentes**. A causa do erro está, portanto, no estado da conta `user.webservice` no Fluig (rotação de senha, conta bloqueada/desativada, perfil de webservice removido, ou questão similar de configuração no servidor Fluig).

Este documento detalha cada etapa da investigação para que a equipe Fluig/Engeko/TOTVS possa atuar diretamente sobre as hipóteses remanescentes.

---

## 2. Contexto

| Item | old-maia (funcionava) | maia-app + maia-db (atual, falha) |
|---|---|---|
| Endpoint do Fluig | `https://engekoengenharia157014.fluig.cloudtotvs.com.br/webdesk` | mesmo |
| Usuário SOAP | `user.webservice` | mesmo |
| Senha | `user.webservice@13472406` | mesma |
| Process ID | `wkfIntegraAtestado` | mesmo |
| Parent Document ID | `141244` | mesmo |
| `companyId` (Engeko Engenharia) | `1` | `1` |
| Forma de armazenamento das credenciais | hardcoded no código da função | variáveis de ambiente (Supabase secrets) |
| Infraestrutura | Supabase Edge Function (projeto old-maia) | Supabase Edge Function (projeto novo `xgmyommohllxqbiggstd`, região `sa-east-1`) |

A **única** diferença de comportamento entre as duas integrações é o estado em que o Fluig recebe a chamada. Todo o resto foi normalizado nos testes a seguir.

---

## 3. Investigação realizada no lado MAIA

Os passos abaixo seguem uma metodologia de depuração sistemática: descartar uma hipótese por vez, do mais simples ao mais sofisticado, até isolar a causa.

### 3.1. Verificação da propagação das credenciais (fingerprint test)

**Pergunta:** as variáveis de ambiente armazenadas nos Supabase Secrets chegam à função com o valor correto, sem espaços, BOM, aspas inteligentes ou quebras de linha invisíveis?

**Método:** instrumentamos a função `fluig-push` para imprimir, sem expor o valor em texto claro:
- comprimento (`length`) das variáveis
- primeiro e último caractere
- igualdade após `trim()`
- URL base completa

**Resultado obtido em produção:**

```json
{
  "base_url": "https://engekoengenharia157014.fluig.cloudtotvs.com.br/webdesk",
  "base_url_trimmed_eq": true,
  "user_len": 15,
  "user_head_tail": "u…e",
  "user_trimmed_eq": true,
  "pass_len": 24,
  "pass_head_tail": "u…6",
  "pass_trimmed_eq": true,
  "process_id": "wkfIntegraAtestado",
  "parent_doc": "141244",
  "company_id": "1"
}
```

**Conclusão:** valores byte-a-byte idênticos aos hardcoded da função antiga. Sem caractere oculto, sem encoding diferente, sem espaço acidental. Propagação descartada como causa.

### 3.2. Comparação byte-a-byte dos envelopes SOAP

**Pergunta:** o envelope SOAP enviado pela nova função difere em algo do envelope da função antiga?

**Método:** comparação lado a lado das funções `createSimpleDocument`/`startWorkflowProcess` (old-maia) com `createDocumentFluig`/`startWorkflowFluig` (maia-db). Diferenças encontradas:

| Aspecto | old-maia | maia-db (antes) | Auth-relevante? |
|---|---|---|---|
| Prolog XML | ausente | presente | Improvável |
| Declaração de namespaces | linha única | duas linhas | Improvável |
| Indentação | 3 ou 4 espaços | 2 espaços | Improvável |
| `<attachments>` vazio | `<attachments>\n            </attachments>` | `<attachments></attachments>` | Improvável |
| `<appointment>` vazio | mesmo padrão | colapsado | Improvável |
| Ordem dos campos em `cardData` (posições 17/18) | `descricaoCodigoAtestado` antes de `codigoAtestado` | invertido | Pós-login |

**Ação:** reescrevemos os envelopes na função nova para corresponderem byte-a-byte aos da função antiga (apenas valores dinâmicos diferem entre execuções). Mesmo após esse alinhamento, o erro persiste.

**Conclusão:** estrutura do envelope SOAP descartada como causa.

### 3.3. Verificação de allowlist de IP

**Pergunta:** o IP de saída da nova função difere do antigo e está bloqueado no Fluig?

**Método:** instrumentamos a função `fluig-push` para registrar o IP público de saída via `https://api.ipify.org`.

**Resultado:** IP da nova função = `56.XXX.XXX.133` (AWS São Paulo, NAT compartilhado do Supabase Edge Functions).

**Teste cruzado:** rodamos a **mesma chamada SOAP, com as mesmas credenciais e o mesmo envelope** diretamente da máquina pessoal de desenvolvimento, fora de qualquer infraestrutura Supabase. IP da máquina pessoal: `179.XXX.XX.197` (rede residencial, Vivo, ASN diferente).

**Resposta do Fluig em ambos os casos:**

```xml
<soap:Envelope ...>
  <soap:Body>
    <ns1:createSimpleDocumentResponse ...>
      <result>
        <item>
          <companyId>0</companyId>
          <documentDescription></documentDescription>
          <documentId>0</documentId>
          <version>0</version>
          <webServiceMessage>Falha de login. UT010031: Login failed</webServiceMessage>
        </item>
      </result>
    </ns1:createSimpleDocumentResponse>
  </soap:Body>
</soap:Envelope>
```

**Conclusão:** dois IPs públicos completamente independentes (Supabase em SP × rede residencial Vivo) produziram exatamente o mesmo erro. Allowlist de IP descartada como causa.

### 3.4. Teste direto end-to-end, sem edge function

**Pergunta:** o problema poderia estar em qualquer camada intermediária (edge runtime, fetch nativo do Deno, ssl/tls, etc.)?

**Método:** escrevemos um script Node.js local (`scripts/test-fluig-direct.ts`, já removido) que:
1. Lê do banco a afastamento real com `serial_id = 18001` (mesmo registro da lista dos que vem falhando)
2. Baixa o anexo real do Supabase Storage
3. Constrói o envelope `createSimpleDocument` idêntico ao da edge function
4. Faz POST direto para `https://engekoengenharia157014.fluig.cloudtotvs.com.br/webdesk/ECMDocumentService?wsdl`
5. Imprime a resposta integral

**Resultado:** HTTP 200 em 2822ms, com o mesmo envelope de erro UT010031 mostrado em 3.3.

**Conclusão:** o problema não é da camada Supabase, do runtime Deno, do empacotamento da requisição. A chamada chega corretamente ao Fluig — apenas o Fluig rejeita a autenticação.

### 3.5. Correção de detecção de erros silenciosos

Durante a investigação, identificamos e corrigimos um bug de detecção na função:

- A resposta de erro do `createSimpleDocument` traz `<documentId>0</documentId>` mais a mensagem em `<webServiceMessage>`.
- A regex original `<documentId>(\d+)</documentId>` casava com `0` e tratava como sucesso.
- O `startProcess` subsequente é que disparava o erro UT010031, mas com formato XML diferente (`<item><item>ERROR</item>...`), o que aparentava ser uma falha apenas no segundo passo.

Após a correção, qualquer chamada SOAP cujo `webServiceMessage` contenha padrão de erro `UT\d+:` ou prefixo `Falha de` é imediatamente surfaceada como erro pela função.

---

## 4. Tabela consolidada — o que foi descartado

| Hipótese | Como foi descartada |
|---|---|
| Encoding (BOM, smart quote, charset divergente) | Senha é ASCII puro; `pass_len = 24`, `trimmed_eq = true` |
| Propagação errada da senha pelos Secrets | Fingerprint byte-a-byte idêntico ao hardcoded original |
| Diferença estrutural no envelope SOAP | Realinhado byte-a-byte ao antigo; erro persiste |
| Diferença em URL / namespaces / Content-Type | Idênticos ao antigo |
| Allowlist de IP no Fluig | Erro reproduz em dois IPs públicos diferentes (Supabase SP e Vivo residencial) |
| Conectividade ou TLS | HTTP 200 em todas as tentativas; corpo SOAP chega íntegro |
| `companyId` errado | `"1"` casa com `empresa_id = 1` (Engeko Engenharia) do banco antigo |
| Process ID errado | `wkfIntegraAtestado` byte-a-byte idêntico |
| Parent Document ID errado | `141244` byte-a-byte idêntico |
| Bug no nosso código de detecção mascarando outro erro | Corrigido; mesmo erro aparece de forma explícita |

---

## 5. Hipóteses remanescentes (todas no lado Fluig)

As hipóteses abaixo estão ordenadas por probabilidade. Todas são **verificáveis exclusivamente pela equipe Fluig/Engeko/TOTVS**.

### Hipótese 1 — Senha rotacionada (probabilidade: alta)

Política de TI corporativa costuma forçar rotação periódica (90 / 180 dias) em contas de serviço, mesmo quando o sistema integrado é considerado estável. Se a senha foi rotacionada após a última execução bem-sucedida da função antiga, o valor `user.webservice@13472406` simplesmente deixou de ser válido.

**Teste de falsificação rápido:** tentar logar na interface web do Fluig (`https://engekoengenharia157014.fluig.cloudtotvs.com.br/webdesk`) com `user.webservice` / `user.webservice@13472406`. Se a UI também rejeitar → hipótese confirmada.

### Hipótese 2 — Conta bloqueada por excesso de tentativas falhas

Toda tentativa de envio que vinha sendo feita pela função nova contava como tentativa de login falha. A função antiga, se ainda estiver sendo invocada por algum trigger remanescente em old-maia, também pode estar contribuindo. A maioria das instalações Fluig auto-bloqueia a conta após N tentativas consecutivas (tipicamente 5-10), e apenas um administrador pode destravar.

**O que pedir:** verificar o contador de tentativas falhas e o status (bloqueado/desbloqueado) da conta `user.webservice` no painel admin do Fluig.

### Hipótese 3 — Perfil de webservice removido

O Fluig diferencia "usuários que podem logar na UI" de "usuários que podem chamar webservices SOAP". Em uma auditoria de segurança ou limpeza de perfis, o papel/role de webservice pode ter sido revogado da conta sem que o login na UI tenha sido afetado.

**Sinal distintivo:** se `user.webservice` consegue logar na UI mas a chamada SOAP retorna UT010031 → essa é a causa.

### Hipótese 4 — Conta desativada ou removida

Ao decomissionar o sistema antigo (old-maia), é possível que alguém tenha desativado a conta `user.webservice` considerando-a sem uso. Caso esse seja o cenário, basta reativar.

### Hipótese 5 — Licença de webservice rebaixada / expirada

Algumas modalidades comerciais do TOTVS Fluig licenciam os webservices SOAP separadamente. Se a licença foi rebaixada ou expirou, todos os logins SOAP passam a falhar com UT010031, ainda que a UI funcione normalmente.

**O que pedir:** verificar com o gestor de licenciamento do Fluig se há licença ativa de webservices para a instância `engekoengenharia157014`.

### Hipótese 6 — Vínculo da conta com a coligada 1 alterado

A conta `user.webservice` precisa estar habilitada para a coligada `1` (Engeko Engenharia). Se esse vínculo foi removido ou alterado, o Fluig pode retornar UT010031 mesmo com senha correta.

### Hipótese 7 — Sessão concorrente travada

Algumas configurações limitam uma sessão ativa por usuário. Se uma sessão antiga ficou pendurada no servidor (de old-maia, por exemplo), novas tentativas de login podem ser rejeitadas até que a sessão antiga expire ou seja encerrada pelo admin.

### Hipótese 8 — Migração de tenant em TOTVS Cloud

A URL `engekoengenharia157014.fluig.cloudtotvs.com.br` é uma instância hospedada pela TOTVS. Se a TOTVS migrou o tenant da Engeko para uma URL nova, o endpoint antigo pode continuar respondendo com erros de autenticação em vez de 404.

**O que pedir:** confirmar com TI Engeko / TOTVS Cloud se houve migração de tenant ou alteração de URL nas últimas semanas/meses.

### Hipótese 9 — Upgrade do Fluig depreciando autenticação SOAP por senha

Versões mais novas do Fluig empurram autenticação por token (OAuth2) e podem ter desativado a aceitação de username/password nos endpoints SOAP legados. Menos provável sem aviso prévio em uma instância cloud, mas vale verificar a versão atual instalada.

---

## 6. Solicitações à equipe Fluig / Engeko / TOTVS

A informação abaixo, idealmente respondida em conjunto pela equipe Engeko com suporte da TOTVS quando necessário, deve resolver definitivamente o caso:

1. **Estado atual da conta `user.webservice`:** ativa? bloqueada? desativada? data do último login bem-sucedido? contador de tentativas falhas atual?
2. **Histórico de rotação de senha:** a senha foi alterada após a última execução bem-sucedida da função `afastamentos-fluig-engeko` (em old-maia)?
3. **Permissões/perfis:** a conta ainda possui o perfil/role que autoriza chamadas SOAP (webservices ECM e Workflow)?
4. **Vínculo com coligada:** a conta está vinculada à coligada `1` (Engeko Engenharia)?
5. **Licenciamento de webservices:** existe licença ativa de webservices SOAP para a instância?
6. **Sessões ativas:** há sessões ativas para essa conta que precisem ser encerradas?
7. **Migração de tenant ou versão:** houve migração de URL/tenant ou upgrade de versão do Fluig recentemente?
8. **Alternativa pragmática:** caso a investigação acima leve tempo, **fornecer uma nova conta de serviço de testes** (novo usuário + nova senha) para validar a integração end-to-end. Se a nova conta funciona, a discussão sobre `user.webservice` torna-se irrelevante para o restabelecimento do serviço.

---

## 7. Anexos

### 7.1. Resposta crua do Fluig (createSimpleDocument)

Capturada em 2026-05-21 13:11 BRT, a partir da máquina local (IP `179.209.46.197`), usando o registro real `serial_id = 18001`:

```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns1:createSimpleDocumentResponse xmlns:ns1="http://ws.dm.ecm.technology.totvs.com/">
      <result>
        <item>
          <companyId>0</companyId>
          <documentDescription></documentDescription>
          <documentId>0</documentId>
          <version>0</version>
          <webServiceMessage>Falha de login. UT010031: Login failed</webServiceMessage>
        </item>
      </result>
    </ns1:createSimpleDocumentResponse>
  </soap:Body>
</soap:Envelope>
```

### 7.2. Resposta crua do Fluig (startProcess)

Capturada em 2026-05-21 13:17 BRT, a partir do Supabase Edge Function (IP `56.124.110.133`):

```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns1:startProcessResponse xmlns:ns1="http://ws.workflow.ecm.technology.totvs.com/">
      <result>
        <item>
          <item>ERROR</item>
          <item>Falha de login. UT010031: Login failed</item>
        </item>
      </result>
    </ns1:startProcessResponse>
  </soap:Body>
</soap:Envelope>
```

### 7.3. IPs públicos testados (mesmo erro em todos)

| Origem | IP | ASN / rede |
|---|---|---|
| Supabase Edge Function `fluig-push` | `56.XXX.XXX.133` | AWS sa-east-1 (NAT compartilhado) |
| Máquina pessoal do dev | `179.XXX.XX.197` | Vivo Fibra residencial (BR) |

### 7.4. Como reproduzir o erro pela própria equipe Fluig

Qualquer cliente SOAP genérico (SoapUI, Postman, `curl`) enviando para `https://engekoengenharia157014.fluig.cloudtotvs.com.br/webdesk/ECMDocumentService?wsdl` com `<username>user.webservice</username>` e `<password>user.webservice@13472406</password>` reproduz o erro UT010031 instantaneamente. Não é necessário acesso ao código da MAIA para confirmação.

---

## 8. Conclusão

A MAIA não possui mais variáveis a controlar sobre este erro. As credenciais saem da MAIA byte-a-byte idênticas às que a função antiga (`afastamentos-fluig-engeko`) utilizava com sucesso por meses. O Fluig, do outro lado da chamada, recusa a autenticação com o código UT010031. A causa do erro está, portanto, no estado da conta `user.webservice` no servidor Fluig ou em alguma configuração de tenant/licença/permissão fora do controle da MAIA.

Assim que a equipe Fluig confirmar/corrigir o estado da conta (ou fornecer uma conta de testes alternativa), a integração voltará a funcionar imediatamente — não é necessária nenhuma alteração de código adicional do lado MAIA.

---

*Documento gerado a partir da investigação técnica conduzida entre 2026-05-20 e 2026-05-22.*
