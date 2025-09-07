import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zhwzrrujseuivxolfuwh.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpod3pycnVqc2V1aXZ4b2xmdXdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njc3OTcwMCwiZXhwIjoyMDcyMzU1NzAwfQ.xwCQlLyx9_vrqxIkE6HWzKWPbmtJyrAceqR8pWN6OZA';
const PIPEFY_TOKEN = 'eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJQaXBlZnkiLCJpYXQiOjE3NTcyNjQzMTEsImp0aSI6IjIwZTY3YjY3LWQxMmEtNDg5MS1hMzdhLTA2NzliNDc4YmFhNiIsInN1YiI6MzA0OTE2MDYzLCJ1c2VyIjp7ImlkIjozMDQ5MTYwNjMsImVtYWlsIjoiYW5kcmFkZS5kYW5pZWwxNTAzOTlAZ21haWwuY29tIn0sInVzZXJfdHlwZSI6ImF1dGhlbnRpY2F0ZWQifQ.Utx2-Hy6MLtkIOq1ppukfc5V7YCTt3GroRpDGzJOu6H9ajbdQSEfe2k0FzB8LIhPOSRp2f9nO8PCpaK0pK5hLg';
const PIPEFY_PIPE_IDS = ["306447075"];
const PIPEFY_STATUS_FIELD = process.env.PIPEFY_STATUS_FIELD || '';
const PIPEFY_OWNER_EMAIL_FIELD = process.env.PIPEFY_OWNER_EMAIL_FIELD || '';

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 8080;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONT_DIR = path.join(__dirname, 'frontend');
app.use(express.static(FRONT_DIR));
app.get('/', (_req, res) => res.sendFile(path.join(FRONT_DIR, 'index.html')));

app.get('/api', (_req, res) => res.json({ ok: true, service: 'PMO Pro API' }));

app.get('/api/inspect/fields', async (req, res) => {
  try {
    const pipeId = req.query.pipeId || PIPEFY_PIPE_IDS[0];
    if (!PIPEFY_TOKEN || !pipeId) return res.status(400).json({ error: 'Configure PIPEFY_TOKEN/PIPEFY_PIPE_IDS' });
    const url = 'https://api.pipefy.com/graphql';
    const query = `query($id:ID!){
      pipe(id:$id){
        id name
        start_form_fields { id label internal_id type }
        phases { name fields { id label internal_id type } }
      }
    }`;
    const body = JSON.stringify({ query, variables: { id: pipeId } });
    const r = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${PIPEFY_TOKEN}`, 'Content-Type': 'application/json' }, body });
    if (!r.ok) throw new Error('Pipefy request failed ' + r.status);
    const json = await r.json();
    if (json.errors) throw new Error('Pipefy errors: ' + JSON.stringify(json.errors));
    const formFields = json.data.pipe.start_form_fields || [];
    const phaseFields = (json.data.pipe.phases || []).flatMap(p => p.fields || []);
    const all = [...formFields, ...phaseFields];
    res.json(all.map(f => ({ label: f.label, internal_id: f.internal_id, type: f.type })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

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
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

async function fetchPipeProjects(pipeId) {
  const url = 'https://api.pipefy.com/graphql';
  const query = `query($id:ID!){
    pipe(id:$id){
      id
      name
      cards(first:100){
        edges{ node{
          id title createdAt updatedAt
          fields{ name field { id label internal_id } value }
        } }
      }
    }
  }`;
  const body = JSON.stringify({ query, variables: { id: pipeId } });
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PIPEFY_TOKEN}`, 'Content-Type': 'application/json' },
    body
  });
  if (!r.ok) throw new Error('Pipefy request failed ' + r.status);
  const json = await r.json();
  if (json.errors) throw new Error('Pipefy errors: ' + JSON.stringify(json.errors));
  const edges = json?.data?.pipe?.cards?.edges || [];
  return edges.map(e => {
    const fields = e.node.fields || [];
    const meta = {};
    for (const f of fields) {
      const iid = f?.field?.internal_id;
      if (iid) meta[iid] = f?.value ?? null;
    }
    const look = (internal_id) => internal_id ? (meta[internal_id] ?? null) : null;
    const status = look(PIPEFY_STATUS_FIELD) || 'imported';
    const owner_email = look(PIPEFY_OWNER_EMAIL_FIELD) || null;
    return {
      external_id: e.node.id,
      name: e.node.title,
      status,
      owner_email,
      meta,
      created_at: e.node.createdAt ? new Date(e.node.createdAt).toISOString() : new Date().toISOString(),
      updated_at: e.node.updatedAt ? new Date(e.node.updatedAt).toISOString() : new Date().toISOString()
    };
  });
}

app.get('/api/professionals', async (_req, res) => {
  const { data, error } = await supabase.from('professionals').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/professionals', async (req, res) => {
  const { name, email, role } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name obrigatório' });
  const { data, error } = await supabase.from('professionals').insert([{ name, email, role }]).select('*').single();
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
  if (!project_id || !professional_id) return res.status(400).json({ error: 'project_id e professional_id são obrigatórios' });
  const { data, error } = await supabase.from('allocations').insert([{ project_id, professional_id, hours, start_date, end_date }]).select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

import fs from 'fs';
app.get('*', (req, res) => {
  const filePath = path.join(FRONT_DIR, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(FRONT_DIR, 'index.html'));
  }
});

app.listen(PORT, () => console.log('PMO Pro listening on http://localhost:' + PORT));
