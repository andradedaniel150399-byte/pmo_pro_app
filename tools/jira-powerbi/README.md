# Jira Cloud → Power BI (atualização automática)

## 1. Gerar o API token (2 min)
1. Acesse https://id.atlassian.com/manage-profile/security/api-tokens
2. **Create API token** (o comum, *sem* escopos). Dê um nome (ex.: `PowerBI-AMP`) e a validade máxima.
3. Copie o token e anote a data de expiração: quando vencer, a atualização para.
   > O ideal é gerar com uma conta técnica/de serviço, não com o usuário pessoal.

## 2. Montar no Power BI Desktop
1. **Página Inicial → Obter dados → Consulta em branco → Editor Avançado**
2. Cole o conteúdo de `Jira_Issues.pq` e troque `SUAEMPRESA` e o `Jql`.
3. Quando pedir credencial: **Básica**
   - Usuário: seu e-mail Atlassian
   - Senha: o API token
   - Nível: a URL raiz `https://SUAEMPRESA.atlassian.net`
4. Repita com `Jira_Campos.pq` (consulta nova) para descobrir os `customfield_10xxx`.
5. Para incluir um campo customizado: adicione o ID em `Campos` e uma linha em `Linhas`, por exemplo:
   `Frente = try f[customfield_10050][value] otherwise null,` (campo de seleção)
   ou `Frente = Record.FieldOrDefault(f, "customfield_10050", null),` (texto/número).
6. **Fechar e Aplicar**.

## 3. Deixar automático (Power BI Service)
1. **Publicar** no workspace.
2. No Service: workspace → modelo semântico → **Configurações**
   - **Credenciais da fonte de dados → Editar**: Básica, mesmo e-mail + token, privacidade *Organizacional*.
     Se der erro no teste, marque *Ignorar conexão de teste*.
   - **Atualização agendada**: ative e defina os horários (Pro: até 8x/dia).
3. Não precisa de gateway: o Jira Cloud é nuvem.

## Limites
- O endpoint é o `/rest/api/3/search/jql` (o antigo `/search` foi descontinuado); 100 issues por página, e a query pagina sozinha.
- Histórico de status (changelog) e worklogs não vêm aqui. Para eles, o caminho é um script que grava num banco (ex.: Supabase) e o PBI lê do banco.
