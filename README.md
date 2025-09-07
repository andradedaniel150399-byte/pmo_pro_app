# PMO Pro — Unified (zero edição)
Suba este repositório único no Render como **Web Service**. Frontend e backend já estão juntos e configurados.

- SUPABASE_URL = https://zhwzrrujseuivxolfuwh.supabase.co
- SUPABASE_SERVICE_ROLE = (embutida no server.js)
- SUPABASE_ANON (frontend) = (embutida em supabase-client.js)
- PIPEFY_TOKEN = (embutido no server.js)
- PIPEFY_PIPE_IDS = 306447075

### Deploy
1. GitHub → New repo → Upload files (tudo desta pasta).
2. Render → New → Web Service → Build from repo
   - Build: npm install
   - Start: node server.js
3. Abra a URL → Sign Up → Sign In → clique "Sincronizar Pipefy".

Rotas:
- /api → health
- /api/inspect/fields?pipeId=306447075
- /api/sync/pipefy (POST)
