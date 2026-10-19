// Lista todos os campos do Jira (inclusive customfield_10xxx) com o nome legível.
// Use para descobrir o ID dos campos customizados e acrescentá-los em "Campos" no Jira_Issues.
let
    SiteUrl = "https://SUAEMPRESA.atlassian.net",
    Fonte   = Json.Document(Web.Contents(SiteUrl, [RelativePath = "rest/api/3/field"])),
    Tabela  = Table.FromRecords(
                List.Transform(Fonte, each [
                    Id = _[id],
                    Nome = _[name],
                    Custom = Record.FieldOrDefault(_, "custom", false),
                    TipoDado = try _[schema][type] otherwise null
                ]),
                type table [Id = text, Nome = text, Custom = logical, TipoDado = text])
in
    Table.Sort(Tabela, {{"Custom", Order.Descending}, {"Nome", Order.Ascending}})
