# PMO Pro — Unified (zero edição)
Suba este repositório único no Render como **Web Service**. Frontend e backend já estão juntos e configurados.

## Variáveis de ambiente

1. **Obtenha as chaves no Supabase**
   - Abra o painel do projeto → *Project Settings* → *API*.
   - Copie os campos **Project URL**, **service\_role** e **anon public**.

2. **Crie o arquivo `.env` local**
   - Na raiz, crie um arquivo `.env` (veja `.env.example`) e defina:
     ```
     SUPABASE_URL=<Project URL>
     SUPABASE_SERVICE_KEY=<service_role>
     SUPABASE_ANON_KEY=<anon public>
     PIPEFY_TOKEN=...
     PIPEFY_PIPE_IDS=...
     PIPEFY_STATUS_FIELD=...
     PIPEFY_OWNER_EMAIL_FIELD=...
     ```
   - O arquivo `.env` está listado no `.gitignore` para evitar commits acidentais.

3. **Configure no Render**
   - No serviço hospedado, abra a aba **Environment**.
   - Adicione as variáveis `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY` e demais chaves com os respectivos valores.
   - Em produção, utilize os mesmos valores do `.env` local.

## Deploy
1. GitHub → New repo → Upload files (tudo desta pasta).
2. Render → New → Web Service → Build from repo
   - Build: `npm install`
   - Start: `node server.js`
   - Defina as variáveis de ambiente acima em **Environment**.
3. Abra a URL → Sign Up → Sign In → clique "Sincronizar Pipefy".

Rotas:
- /api → health
- /api/inspect/fields?pipeId=<ID>
- /api/sync/pipefy (POST)
