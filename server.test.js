import test from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';

// Ensure the server exits with code 1 when required Supabase env vars are missing.
test('server fails fast when Supabase env vars are missing', async () => {
  await new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['server.js'], {
      env: { ...process.env, SUPABASE_URL: '', SUPABASE_SERVICE_KEY: '' },
    });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      try {
        assert.strictEqual(code, 1);
        assert.match(stderr, /Configure SUPABASE_URL e SUPABASE_SERVICE_KEY/);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
});
