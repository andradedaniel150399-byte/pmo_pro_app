#!/usr/bin/env node
/*
  tools/inspect_projects.js
  Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node tools/inspect_projects.js [limit]
*/

import { createClient } from '@supabase/supabase-js';

const limit = Math.max(1, Math.min(200, Number(process.argv[2] || 20)));
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Define SUPABASE_URL and SUPABASE_SERVICE_KEY in environment');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

(async () => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('external_id,name,pipefy_status,pipefy_owner_email,pipefy_priority,estimated_hours,started_at,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    console.log(JSON.stringify({ items: data || [] }, null, 2));
  } catch (e) {
    console.error('Error querying projects:', e.message || e);
    process.exit(3);
  }
})();
