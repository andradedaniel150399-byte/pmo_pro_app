// Jira Cloud -> Power BI: todas as issues do JQL abaixo, com paginação.
// Cole em: Obter dados > Consulta em branco > Editor Avançado.
// Credencial (quando pedir): Básica | usuário = seu e-mail Atlassian | senha = API token
let
    // ==== AJUSTE AQUI ====
    SiteUrl = "https://SUAEMPRESA.atlassian.net",
    Jql     = "project = AMP ORDER BY created ASC",
    Campos  = "summary,status,issuetype,priority,assignee,reporter,parent,labels,created,updated,duedate,resolutiondate",
    // =====================

    // URL base fixa + RelativePath/Query: obrigatório para a atualização agendada funcionar no Power BI Service
    GetPage = (token as nullable text) as record =>
        Json.Document(Web.Contents(SiteUrl, [
            RelativePath = "rest/api/3/search/jql",
            Query = [jql = Jql, fields = Campos, maxResults = "100"]
                    & (if token = null then [] else [nextPageToken = token]),
            Headers = [Accept = "application/json"]
        ])),

    Paginas = List.Generate(
        () => GetPage(null),
        each _ <> null,
        each if Record.FieldOrDefault(_, "isLast", true)
                or Record.FieldOrDefault(_, "nextPageToken", null) = null
             then null
             else GetPage(_[nextPageToken])
    ),
    Issues = List.Combine(List.Transform(Paginas, each _[issues])),

    // Jira manda datas como "2026-10-16T10:23:45.123-0300"; pega os 19 primeiros caracteres
    ParseDT = (v) => if v = null then null else DateTime.FromText(Text.Start(v, 19)),
    ParseD  = (v) => if v = null then null else Date.FromText(v),

    Linhas = List.Transform(Issues, (i) =>
        let f = i[fields] in [
            Chave           = i[key],
            Id              = i[id],
            Resumo          = Record.FieldOrDefault(f, "summary", null),
            Status          = try f[status][name] otherwise null,
            CategoriaStatus = try f[status][statusCategory][name] otherwise null,
            Tipo            = try f[issuetype][name] otherwise null,
            Prioridade      = try f[priority][name] otherwise null,
            Responsavel     = try f[assignee][displayName] otherwise null,
            Relator         = try f[reporter][displayName] otherwise null,
            Pai             = try f[parent][key] otherwise null,
            Labels          = try Text.Combine(f[labels], "; ") otherwise null,
            Criado          = ParseDT(Record.FieldOrDefault(f, "created", null)),
            Atualizado      = ParseDT(Record.FieldOrDefault(f, "updated", null)),
            Resolvido       = ParseDT(Record.FieldOrDefault(f, "resolutiondate", null)),
            Vencimento      = ParseD(Record.FieldOrDefault(f, "duedate", null)),
            Link            = SiteUrl & "/browse/" & i[key]
        ]),

    Tabela = Table.FromRecords(Linhas,
        type table [
            Chave = text, Id = text, Resumo = text, Status = text, CategoriaStatus = text,
            Tipo = text, Prioridade = text, Responsavel = text, Relator = text, Pai = text,
            Labels = text, Criado = datetime, Atualizado = datetime, Resolvido = datetime,
            Vencimento = date, Link = text
        ])
in
    Tabela
