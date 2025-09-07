# PMO Pro — Unified (zero edição)
Suba este repositório único no Render como **Web Service**. Frontend e backend já estão juntos e configurados.

## Variáveis de ambiente

Crie um arquivo `.env` na raiz (veja `.env.example`) com as chaves necessárias:

```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
SUPABASE_ANON_KEY=...
PIPEFY_TOKEN=...
PIPEFY_PIPE_IDS=...
PIPEFY_STATUS_FIELD=...
PIPEFY_OWNER_EMAIL_FIELD=...
```

Em produção, configure as mesmas variáveis no painel do serviço de deploy.
O arquivo `.env` está listado no `.gitignore` para evitar commits acidentais.

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
