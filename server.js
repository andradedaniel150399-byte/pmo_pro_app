// server.js — PMO Pro (com métricas de dashboard)

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// ===== Logs de segurança =====
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
process.on('uncaughtException',  (e) => console.error('[uncaughtException]', e));

// ===== Configuração via variáveis de ambiente =====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PIPEFY_TOKEN = process.env.PIPEFY_TOKEN;
const PIPEFY_PIPE_IDS = (process.env.PIPEFY_PIPE_IDS || '').split(',').filter(Boolean);
const PIPEFY_STATUS_FIELD = process.env.PIPEFY_STATUS_FIELD || '';
const PIPEFY_OWNER_EMAIL_FIELD = process.env.PIPEFY_OWNER_EMAIL_FIELD || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());
// Use port provided by environment (Render) or default to 3000 for local dev
const PORT = process.env.PORT || 3000;
// Garante que a aplicação falhe de forma descritiva caso as variáveis do
// Supabase não estejam configuradas. Sem esses valores, o `createClient`
// lança um erro pouco claro ("supabaseUrl is required"), interrompendo o
// deploy no Render.
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Configure SUPABASE_URL e SUPABASE_SERVICE_KEY no ambiente.');
  process.exit(1);
}

if (!SUPABASE_ANON_KEY) {
  console.error('Configure SUPABASE_ANON_KEY no ambiente.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Modo mock local para facilitar smoke-tests locais quando quem estiver
// executando fornecer variáveis 'dummy' (útil no dev container). Isso evita
// falhas de conexão com um Supabase inexistente e permite testar o frontend.
const MOCK_DEV = process.env.MOCK_DEV === '1' || SUPABASE_URL?.includes('localhost') || (SUPABASE_SERVICE_KEY || '').includes('dummy');

console.log(`🔧 Starting server in ${MOCK_DEV ? 'MOCK_DEV' : 'PRODUCTION'} mode`);
console.log(`📊 SUPABASE_URL: ${SUPABASE_URL?.slice(0, 20)}...`);
console.log(`🔑 MOCK_DEV flag: ${process.env.MOCK_DEV}`);

// Expor variáveis públicas para o frontend
app.get('/env.js', (_req, res) => {
  res.type('application/javascript');
  res.send(
    `window.env = { SUPABASE_URL: '${SUPABASE_URL}', SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}' };`
  );
});

// __dirname (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const FRONT_DIR  = path.join(__dirname, 'frontend');

app.use(express.static(FRONT_DIR));
app.get('/', (_req, res) => res.sendFile(path.join(FRONT_DIR, 'index.html')));

// Health
app.get('/api', (_req, res) => res.json({ ok: true, service: 'PMO Pro API' }));

// ===== Pipefy: inspecionar campos =====
app.get('/api/inspect/fields', async (req, res) => {
  try {
    const pipeId = req.query.pipeId || PIPEFY_PIPE_IDS[0];
    if (!PIPEFY_TOKEN || !pipeId) {
      return res.status(400).json({ error: 'Configure PIPEFY_TOKEN e PIPEFY_PIPE_IDS' });
    }
    const url = 'https://api.pipefy.com/graphql';
    const query = `query($id:ID!){
      pipe(id:$id){
        id name
        start_form_fields { id label internal_id type }
        phases { name fields { id label internal_id type } }
      }
    }`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PIPEFY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: pipeId } })
    });
    if (!r.ok) throw new Error('Pipefy request failed ' + r.status);
    const json = await r.json();
    if (json.errors) throw new Error('Pipefy errors: ' + JSON.stringify(json.errors));
    const form = json.data.pipe.start_form_fields || [];
    const phases = (json.data.pipe.phases || []).flatMap(p => p.fields || []);
    const all = [...form, ...phases];
    res.json(all.map(f => ({ label: f.label, internal_id: f.internal_id, type: f.type })));
  } catch (e) {
    console.error('[inspect/fields]', e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ===== Pipefy: sincronizar para projects =====
app.post('/api/sync/pipefy', async (_req, res) => {
  try {
    if (!PIPEFY_TOKEN || PIPEFY_PIPE_IDS.length === 0) {
      return res.status(400).json({ error: 'Configure PIPEFY_TOKEN e PIPEFY_PIPE_IDS' });
    }
    let upserts = 0;
    for (const pipeId of PIPEFY_PIPE_IDS) {
      const entries = await fetchPipeProjects(pipeId);
      if (entries.length === 0) continue;
      // (no debug logging in production)
      const { error } = await supabase.from('projects').upsert(entries, { onConflict: 'external_id' });
      if (error) throw error;
      upserts += entries.length;
    }
    res.json({ ok: true, upserts });
  } catch (e) {
    console.error('[sync/pipefy]', e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ===== Métricas para o dashboard =====
app.get('/api/metrics/overview', async (_req, res) => {
  try {
    if (MOCK_DEV) {
      return res.json({ total_projects: 3, projects_last_30d: 1, owners: 2, by_status: { imported: 2, open: 1 }, total_allocations: 2, total_hours: 40 });
    }
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .limit(5000);
    if (error) throw error;

    const byStatus = {};
    const owners = new Set();
    let recent30 = 0;
    const now = Date.now();
    projects.forEach(p => {
      const s = (p.status || 'sem_status').toLowerCase();
      byStatus[s] = (byStatus[s] || 0) + 1;
      if (p.owner_email) owners.add(p.owner_email);
      if (p.created_at && (now - new Date(p.created_at).getTime()) <= 30*864e5) recent30++;
    });

    const { data: allocations, error: e2 } = await supabase
      .from('allocations')
      .select('*')
      .limit(5000);
    if (e2) throw e2;

    const totalHours = allocations.reduce((s, a) => s + (a.hours || 0), 0);

    res.json({
      total_projects: projects.length,
      projects_last_30d: recent30,
      owners: owners.size,
      by_status: byStatus,
      total_allocations: allocations.length,
      total_hours: totalHours
    });
  } catch (e) {
    console.error('[metrics/overview]', e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/metrics/timeseries', async (req, res) => {
  try {
    const days = Math.max(7, Math.min(90, Number(req.query.days || 30)));
    const sinceISO = new Date(Date.now() - days * 864e5).toISOString();
    const { data, error } = await supabase
      .from('projects')
      .select('created_at')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: true })
      .limit(5000);
    if (error) throw error;

    const seed = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date(Date.now() - (days - i) * 864e5).toISOString().slice(0, 10);
      seed[d] = 0;
    }
    (data || []).forEach(r => {
      const k = (r.created_at || '').slice(0,10);
      if (k in seed) seed[k]++;
    });

    const labels = Object.keys(seed);
    const values = labels.map(k => seed[k]);
    res.json({ labels, values });
  } catch (e) {
    console.error('[metrics/timeseries]', e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/metrics/top-projects', async (req, res) => {
  try {
    if (MOCK_DEV) {
      return res.json({ items: [{ id: 'p1', name: 'Projeto A', status: 'Em andamento', owner_email: 'a@x.com', hours: 20 }, { id: 'p2', name: 'Projeto B', status: 'Concluído', owner_email: 'b@x.com', hours: 10 }] });
    }
    const limit = Math.max(3, Math.min(20, Number(req.query.limit || 10)));
    const { data: allocs, error } = await supabase
      .from('allocations')
      .select('project_id,hours')
      .limit(5000);
    if (error) throw error;

    const hoursByProject = {};
    (allocs || []).forEach(a => {
      if (!a.project_id) return;
      hoursByProject[a.project_id] = (hoursByProject[a.project_id] || 0) + (a.hours || 0);
    });

    const ids = Object.keys(hoursByProject);
    const { data: projects, error: e2 } = await supabase
      .from('projects')
      .select('id,name,status,owner_email,created_at')
      .in('id', ids.length ? ids : [-1])
      .limit(5000);
    if (e2) throw e2;

    const list = (projects || [])
      .map(p => ({ ...p, hours: hoursByProject[p.id] || 0 }))
      .sort((a,b) => b.hours - a.hours)
      .slice(0, limit);

    res.json({ items: list });
  } catch (e) {
    console.error('[metrics/top-projects]', e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ===== CRUD já existentes =====
// Listar projetos (com filtros simples). Usado pelo novo SPA.
app.get('/api/projects', async (req, res) => {
  try {
    if (MOCK_DEV) {
      return res.json({
        data: [
          { id: 1, external_id: 'p1', name: 'Projeto Demo A', pipefy_status: 'in_progress', pipefy_owner_email: 'ownerA@example.com', pipefy_priority: 'high', estimated_hours: 80, started_at: '2025-09-01', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 2, external_id: 'p2', name: 'Projeto Demo B', pipefy_status: 'imported', pipefy_owner_email: 'ownerB@example.com', pipefy_priority: 'medium', estimated_hours: 40, started_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 3, external_id: 'p3', name: 'Projeto Demo C', pipefy_status: 'done', pipefy_owner_email: 'ownerC@example.com', pipefy_priority: 'low', estimated_hours: 10, started_at: '2025-08-15', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ]
      });
    }

    const { status, owner_limit } = req.query || {};
    let q = supabase
      .from('projects')
      .select('id,external_id,name,pipefy_status,pipefy_owner_email,pipefy_priority,estimated_hours,started_at,status,owner_email,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(1000, Number(limit) || 500)));
    if (status) q = q.eq('pipefy_status', status);
    if (owner_email) q = q.eq('pipefy_owner_email', owner_email);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data });
  } catch (e) {
    console.error('[projects:list]', e);
    res.status(500).json({ error: e.message });
  }
});

// Substituir bloco de /api/professionals (GET, POST, PUT, DELETE) pelo abaixo:

app.get('/api/professionals', async (_req, res) => {
  if (MOCK_DEV) {
    return res.json([
      { id: 1, name: 'Alice', role: 'PM', hourly_rate: 120, cost: 9000, utilization: 0.75, created_at: new Date().toISOString() },
      { id: 2, name: 'Bruno', role: 'Dev', hourly_rate: 80, cost: 6000, utilization: 0.60, created_at: new Date().toISOString() }
    ]);
  }
  const { data, error } = await supabase
    .from('professionals')
    .select('id,created_at,name,role,cost,utilization,hourly_rate,user_id')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/professionals', async (req, res) => {
  const { name, role, cost, utilization, hourly_rate, user_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name obrigatório' });
  if (MOCK_DEV) {
    return res.json({
      id: Date.now(),
      name,
      role: role || null,
      cost: cost ?? null,
      utilization: utilization ?? null,
      hourly_rate: hourly_rate ?? null,
      user_id: user_id || null,
      created_at: new Date().toISOString()
    });
  }
  const insertRow = { name };
  if (role !== undefined) insertRow.role = role;
  if (cost !== undefined) insertRow.cost = cost;
  if (utilization !== undefined) insertRow.utilization = utilization;
  if (hourly_rate !== undefined) insertRow.hourly_rate = hourly_rate;
  if (user_id !== undefined) insertRow.user_id = user_id;
  const { data, error } = await supabase
    .from('professionals')
    .insert([insertRow])
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/professionals/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role, cost, utilization, hourly_rate, user_id } = req.body || {};
  const update = {};
  for (const [k,v] of Object.entries({ name, role, cost, utilization, hourly_rate, user_id })) {
    if (v !== undefined) update[k] = v;
  }
  if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Nada para atualizar' });
  if (MOCK_DEV) return res.json({ id, ...update, updated_at: new Date().toISOString() });
  const { data, error } = await supabase
    .from('professionals')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
});

app.delete('/api/professionals/:id', async (req, res) => {
  const { id } = req.params;
  if (MOCK_DEV) return res.json({ ok: true, deleted: 1 });
  const { error } = await supabase.from('professionals').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Ajustar GET /api/allocations (substituir o bloco atual):
app.get('/api/allocations', async (req, res) => {
  try {
    if (MOCK_DEV) {
      return res.json([
        { id: 'a1', project_id: 1, professional_id: 1, hours: 8, date: '2025-09-16', type: 'dev' },
        { id: 'a2', project_id: 2, professional_id: 2, hours: 4, date: '2025-09-15', type: 'review' }
      ]);
    }

    const { project_id, professional_id, start_date, end_date, limit } = req.query || {};
    let q = supabase
      .from('allocations_view')
      .select('*')
      .order('date', { ascending: false })
      .limit(Math.max(1, Math.min(1000, Number(limit) || 500)));

    if (project_id) q = q.eq('project_id', project_id);
    if (professional_id) q = q.eq('professional_id', professional_id);
    if (start_date) q = q.gte('date', start_date);
    if (end_date) q = q.lte('date', end_date);

    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error('[allocations:list]', e);
    res.status(500).json({ error: e.message });
  }
});

// Ajustar cleanup (caso view/base use date):
app.post('/api/allocations/cleanup', async (req, res) => {
  try {
    const { month, professional_id, project_id } = req.body || {};
    if (!month && !professional_id && !project_id) {
      return res.status(400).json({ error: 'Informe ao menos um filtro' });
    }

    let del = supabase.from('allocations').delete();

    if (month) {
      const start = `${month}-01`;
      const endDate = new Date(start);
      endDate.setMonth(endDate.getMonth() + 1);
      const end = endDate.toISOString().slice(0,10);
      // assumindo coluna date
      del = del.gte('date', start).lt('date', end);
    }
    if (professional_id) del = del.eq('professional_id', professional_id);
    if (project_id) del = del.eq('project_id', project_id);

    const { data, error } = await del.select('id');
    if (error) throw error;
    res.json({ ok: true, deleted: data.length });
  } catch (e) {
    console.error('[allocations/cleanup]', e);
    res.status(500).json({ error: e.message });
  }
});

// Criar alocação (garantir uso de date):
// Substituir o POST /api/allocations atual por este:
app.post('/api/allocations', async (req, res) => {
  try {
    let { project_id, professional_id, hours, date, type } = req.body || {};
    if (!project_id || !professional_id || hours === undefined) {
      return res.status(400).json({ error: 'project_id, professional_id e hours são obrigatórios' });
    }
    const numericHours = Number(hours);
    if (Number.isNaN(numericHours) || numericHours <= 0) {
      return res.status(400).json({ error: 'hours inválido' });
    }
    if (!date) date = new Date().toISOString().slice(0,10);

    if (MOCK_DEV) {
      return res.json({
        id: 'mock-' + Date.now(),
        project_id,
        professional_id,
        hours: numericHours,
        date,
        type: type || null
      });
    }

    const insertRow = { project_id, professional_id, hours: numericHours, date };
    if (type) insertRow.type = type;

    const { data, error } = await supabase
      .from('allocations')
      .insert([insertRow])
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error('[allocations:create]', e);
    res.status(500).json({ error: e.message });
  }
});

// ===== Helpers do Pipefy (sem createdAt/updatedAt do schema) =====
async function fetchPipeProjects(pipeId) {
  const url = 'https://api.pipefy.com/graphql';
  const headers = { 'Authorization': `Bearer ${PIPEFY_TOKEN}`, 'Content-Type': 'application/json' };

  // allCards (API nova)
  let query = `query($pipeId:ID!){
    allCards(pipeId:$pipeId, first:200){
      edges{ node{
        id
        title
        fields{ name value field { id label internal_id } }
      } }
    }
  }`;
  let r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables: { pipeId } }) });
  let json = await r.json();

  if (!r.ok || json.errors || !json?.data?.allCards) {
    // fallback por fases
    query = `query($id:ID!){
      pipe(id:$id){
        id name
        phases{
          name
          cards(first:200){
            edges{ node{
              id
              title
              fields{ name value field { id label internal_id } }
            } }
          }
        }
      }
    }`;
    r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables: { id: pipeId } }) });
    json = await r.json();
    if (json.errors) throw new Error('Pipefy errors (fallback): ' + JSON.stringify(json.errors));

    const edges = (json?.data?.pipe?.phases || []).flatMap(ph => (ph.cards?.edges || []));
    return mapCards(edges.map(e => e.node));
  }

  const edges = json.data.allCards.edges || [];
  return mapCards(edges.map(e => e.node));
}

function mapCards(nodes) {
  return nodes.map(n => {
    const meta = {};
    (n.fields || []).forEach(f => {
      const iid = f?.field?.internal_id;
      if (iid) meta[iid] = f?.value ?? null;
    });
    const look = (iid) => (iid ? (meta[iid] ?? null) : null);
    // Map known fields into top-level columns when available. The
    // environment variables PIPEFY_STATUS_FIELD and PIPEFY_OWNER_EMAIL_FIELD
    // contain the internal_id of the corresponding Pipefy form fields.
    const status = look(PIPEFY_STATUS_FIELD) || 'imported';
    const owner_email = look(PIPEFY_OWNER_EMAIL_FIELD) || null;
    const priority = look('priority') || look('prioridade') || look('priority_level') || null;
    // estimated hours may come as string/number; attempt to coerce to number
    const estimated_raw = look('estimated_hours') || look('estimated') || look('estimativa_horas') || null;
    const estimated_hours = estimated_raw == null ? null : Number(String(estimated_raw).replace(/[^0-9\.\-]/g, '')) || null;
    // started_at may be a date-like string in meta
    const started_raw = look('started_at') || look('date') || look('data_inicio') || null;
    let started_at = null;
    if (started_raw) {
      const d = new Date(started_raw);
      if (!Number.isNaN(d.getTime())) started_at = d.toISOString().slice(0, 10);
    }

    const nowISO = new Date().toISOString();

    return {
      external_id: n.id,
      name: n.title,
      pipefy_status: status,
      pipefy_owner_email: owner_email,
      pipefy_priority: priority,
      estimated_hours,
      started_at,
      meta,
      created_at: nowISO,
      updated_at: nowISO
    };
  });
}

// ===== LLM / Gemini proxy (mock em dev) =====
app.post('/api/gemini', async (req, res) => {
  try {
    if (MOCK_DEV) return res.json({ ok: true, text: 'Resposta mock do Gemini (MOCK_DEV)', echo: req.body });
    if (!GEMINI_API_KEY) return res.status(400).json({ error: 'GEMINI_API_KEY não configurado' });
    // Aqui ficaria o forward para o fornecedor LLM (ex.: OpenAI, Vertex)
    res.json({ ok: true, echo: req.body });
  } catch (e) {
    console.error('[api/gemini]', e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// (debug route removed)

// ===== SPA fallback =====
app.get('*', (req, res) => {
  const p = path.join(FRONT_DIR, req.path);
  res.sendFile(path.extname(p) ? p : path.join(FRONT_DIR, 'index.html'), (err) => {
    if (err) res.sendFile(path.join(FRONT_DIR, 'index.html'));
  });
});

// Bind explicitly to all IPv4 interfaces to avoid local "connection refused" issues
// on systems where localhost resolves differently.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔧 Mode: ${process.env.MOCK_DEV ? 'MOCK_DEV' : 'PRODUCTION'}`);
});
