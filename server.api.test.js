import test from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import http from 'node:http';

// Helper to perform HTTP requests
function request(path, { method = 'GET', body } = {}) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : null;
    const req = http.request({ hostname: 'localhost', port: 3001, path, method, headers: { 'Content-Type': 'application/json', 'Content-Length': dataStr ? Buffer.byteLength(dataStr) : 0 } }, res => {
      let buf = '';
      res.on('data', d => (buf += d));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(buf); } catch { /* ignore */ }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

// Start server in MOCK_DEV with dummy supabase env before tests
let proc;
test('setup server', async (t) => {
  proc = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: '3001', SUPABASE_URL: 'http://localhost/dummy', SUPABASE_SERVICE_KEY: 'dummy', SUPABASE_ANON_KEY: 'dummy' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    let ready = false;
    proc.stdout.on('data', () => { if (!ready) { ready = true; setTimeout(resolve, 300); } });
    proc.stderr.on('data', () => { if (!ready) { ready = true; setTimeout(resolve, 300); } });
    proc.on('exit', (code) => reject(new Error('server exited early: ' + code)));
  });
  t.diagnostic('Server started in MOCK_DEV on :3001');
});

test('GET /api health', async () => {
  const r = await request('/api');
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
});

test('GET /api/projects returns mock list', async () => {
  const r = await request('/api/projects');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.data));
  assert.ok(r.json.data.length >= 1);
});

test('GET /api/professionals returns mock list', async () => {
  const r = await request('/api/professionals');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json));
  assert.ok(r.json.length >= 1);
});

test('POST /api/professionals creates mock professional', async () => {
  const r = await request('/api/professionals', { method: 'POST', body: { name: 'Teste', email: 't@e.com', role: 'Dev', hourly_rate: 100 } });
  assert.equal(r.status, 200);
  assert.equal(r.json.name, 'Teste');
});

test('POST /api/allocations creates mock allocation', async () => {
  const r = await request('/api/allocations', { method: 'POST', body: { project_id: 'p1', professional_id: 'u1', hours: 10 } });
  assert.equal(r.status, 200);
  assert.equal(r.json.hours, 10);
});

test('POST /api/sync/pipefy without env returns 400', async () => {
  const r = await request('/api/sync/pipefy', { method: 'POST' });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /Configure PIPEFY_TOKEN/);
});

test('teardown server', async () => {
  proc.kill('SIGTERM');
});