// server.js — PMO Pro (com métricas de dashboard)

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// ===== Logs de segurança =====
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
process.on('uncaughtException',  (e) => console.error('[uncaughtException]', e));

// ===== Config fixa (pedido do usuário) =====
const SUPABASE_URL = 'https://zhwzrrujseuivxolfuwh.supabase.co';
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpod3pycnVqc2V1aXZ4b2xmdXdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njc3OTcwMCwiZXhwIjoyMDcyMzU1NzAwfQ.xwCQlLyx9_vrqxIkE6HWzKWPbmtJyrAceqR8pWN6OZA';

const PIPEFY_TOKEN =
  'eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NTcyNjQzMTEsImp0aSI6IjIwZTY3YjY3LWQxMmEtNDg5MS1hMzdhLTA2NzliNDc4YmFhNiIsInN1YiI6MzA0OTE2MDYzLCJ1c2VyIjp7ImlkIjozMDQ5MTYwNjMsImVtYWlsIjoiYW5kcmFkZS5kYW5pZWwxNTAzOTlAZ21haWwuY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Utx2-Hy6MLtkIOq1ppukfc5V7YCTt3GroRpDGzJOu6H9ajbdQSEfe2k0FzB8LIhPOSRp2f9nO8PCpaK0pK5hLg';

const PIPEFY_PIPE_IDS = ['306447075']; // seu pipe
const PIPEFY_STATUS_FIELD = process.env.PIPEFY_STATUS_FIELD || '';
const PIPEFY_OWNER_EMAIL_FIELD = process.env.PIPEFY_OWNER_EMAIL_FIELD || '';

const app = express();
app.use(cors());
app.use(express.json());
// Use port provided by environment (Render) or default to 3000 for local dev
const PORT = process.env.PORT || 3000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
app.get('/api/projects', async (req, res) => {
  const search = (req.query.search || '').toString().trim();
  let query = supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (search) query = query.ilike('name', `%${search}%`);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/projects', async (req, res) => {
  const { name, external_id, status, owner_email } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name obrigatório' });
  const { data, error } = await supabase
    .from('projects')
    .insert([{ name, external_id, status, owner_email }])
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/projects/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const { name, external_id, status, owner_email } = req.body || {};
  const updates = { name, external_id, status, owner_email, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/projects/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.get('/api/professionals', async (_req, res) => {
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/professionals', async (req, res) => {
  const { name, email, role } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name obrigatório' });
  const { data, error } = await supabase
    .from('professionals')
    .insert([{ name, email, role }])
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/allocations', async (_req, res) => {
  const { data, error } = await supabase
    .from('allocations_view')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/allocations', async (req, res) => {
  const { project_id, professional_id, hours, start_date, end_date } = req.body || {};
  if (!project_id || !professional_id) {
    return res.status(400).json({ error: 'project_id e professional_id são obrigatórios' });
  }
  const { data, error } = await supabase
    .from('allocations')
    .insert([{ project_id, professional_id, hours, start_date, end_date }])
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
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
    const status = look(PIPEFY_STATUS_FIELD) || 'imported';
    const owner_email = look(PIPEFY_OWNER_EMAIL_FIELD) || null;
    const nowISO = new Date().toISOString();

    return {
      external_id: n.id,
      name: n.title,
      status,
      owner_email,
      meta,
      created_at: nowISO,
      updated_at: nowISO
    };
  });
}

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
  console.log(`PMO Pro listening on http://localhost:${PORT}`);
});
