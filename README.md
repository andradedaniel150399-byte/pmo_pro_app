# PMO Pro — Unified (zero edição)
Suba este repositório único no Render como **Web Service**. Frontend e backend já estão juntos e configurados.

## Requisitos

- Node.js 18 ou superior é obrigatório, tanto localmente quanto no Render.
  - Instale com [nvm](https://github.com/nvm-sh/nvm): `nvm install 18` e `nvm use 18`

## Variáveis de ambiente

### Supabase

1. Acesse o painel do projeto e clique em **Settings → API**.
2. Copie os valores dos campos abaixo e use-os nas variáveis correspondentes:
   - `SUPABASE_URL` → **Project URL**
   - `SUPABASE_SERVICE_KEY` → **service_role**
   - `SUPABASE_ANON_KEY` → **anon public**

> Sem `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` e `SUPABASE_ANON_KEY`, o servidor não inicia.

### Pipefy

- `PIPEFY_TOKEN`: token de API disponível em <https://app.pipefy.com/profile/developers>.
- `PIPEFY_PIPE_IDS`: IDs dos pipes a sincronizar (separe múltiplos com vírgula).
- `PIPEFY_STATUS_FIELD`: nome ou ID do campo de status usado nos cards.
- `PIPEFY_OWNER_EMAIL_FIELD`: nome ou ID do campo que armazena o e-mail do responsável.

### Arquivo `.env` local

1. Copie `.env.example` para `.env` e preencha com os valores obtidos.
2. O arquivo `.env` está listado no `.gitignore` para evitar commits acidentais.
3. Use Node.js 18+ antes de rodar o servidor (ex.: `nvm use 18`).

### Configuração no Render

1. Após criar o serviço, abra a aba **Environment**.
2. Cadastre `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `PIPEFY_TOKEN`, `PIPEFY_PIPE_IDS`, `PIPEFY_STATUS_FIELD` e `PIPEFY_OWNER_EMAIL_FIELD` com os mesmos valores do `.env` local.
3. Salve e reinicie o serviço para aplicar.

## Banco de dados (Supabase)

O arquivo [`supabase-schema.sql`](./supabase-schema.sql) contém as tabelas e views usadas pela aplicação:
`projects`, `professionals`, `allocations` e `allocations_view`.

### Executar pelo dashboard
1. Acesse o projeto no [app.supabase.com](https://app.supabase.com/).
2. Abra **SQL Editor → New query**.
3. Copie o conteúdo de `supabase-schema.sql` e clique em **Run**.

### Executar via CLI
1. Instale o [Supabase CLI](https://supabase.com/docs/guides/cli) e faça login (`supabase login`).
2. Vincule seu projeto: `supabase link --project-ref <REF_DO_PROJETO>`.
3. Rode o script: `supabase db query supabase-schema.sql`.

## Deploy
1. GitHub → New repo → Upload files (tudo desta pasta).
2. Render → New → Web Service → Build from repo
   - Runtime: Node 18
   - Build: `npm install`
   - Start: `node server.js`
   - Defina as variáveis de ambiente acima em **Environment**.
3. Abra a URL → Sign Up → Sign In → clique "Sincronizar Pipefy".

Rotas:
- /api → health
- /api/inspect/fields?pipeId=<ID>
- /api/sync/pipefy (POST)

### Frontend

## Migração: colunas Pipefy (projects)

Se você já tem uma instância do banco, aplique a migration que adiciona colunas tipadas para os campos do Pipefy na tabela `projects`. O arquivo com o SQL está em `db/migrations/001_add_pipefy_columns.sql`.

Passos rápidos:

- Pelo painel do Supabase: abra o projeto → SQL Editor → cole o conteúdo de `db/migrations/001_add_pipefy_columns.sql` → Run.
- Via supabase CLI:
   ```bash
   supabase db query < db/migrations/001_add_pipefy_columns.sql
   ```
- Via psql (conexão direta):
   ```bash
   psql "postgresql://<db_user>:<db_pass>@<db_host>:5432/<db_name>" -f db/migrations/001_add_pipefy_columns.sql
   ```

Depois de aplicar, rode `POST /api/sync/pipefy` para popular/atualizar os campos `pipefy_*`.


### Runner local de migrations (opcional)

Criei um pequeno utilitário Node para aplicar todas as migrations em `db/migrations` de forma automática: `tools/run_migrations.js`.

Passos:

1. Instale a dependência do cliente Postgres (apenas se ainda não estiver instalada):

```bash
npm install pg
```

2. Rode as migrations apontando `DATABASE_URL` ou passando `--url`:

```bash
# usando env
DATABASE_URL="postgresql://user:pass@host:5432/dbname" npm run migrate

# ou diretamente
node tools/run_migrations.js --url "postgresql://user:pass@host:5432/dbname"
```

3. Confirme o prompt (ou passe `--yes` para confirmar automaticamente).

Observação: o script aplica os arquivos em ordem alfabética; tenha cuidado em produção e faça backup antes.


O `dashboard.js` agora centraliza os botões de sincronização e logout. A função `handleLogout` está disponível em `ui.js` para que qualquer página possa encerrar a sessão.
