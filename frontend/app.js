document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace('index.html');
    return;
  }
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = session.user?.email || '(sem e-mail)';
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('index.html');
  });

  await refreshKPIs();
  await loadProjects();
  await loadProfessionals();
  await loadAllocations();

  const syncBtn = document.getElementById('btn-sync-pipefy');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      syncBtn.textContent = 'Sincronizando...';
      try {
        const resp = await fetch('/api/sync/pipefy', { method: 'POST' });
        if (!resp.ok) throw new Error('Falha: ' + resp.status);
        const json = await resp.json();
        alert('Sincronizado: ' + (json?.upserts ?? 0) + ' projetos');
        await loadProjects();
        await refreshKPIs();
      } catch (e) {
        console.error(e);
        alert('Erro: ' + e.message);
      } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sincronizar Pipefy → Projetos';
      }
    });
  }

  const proForm = document.getElementById('pro-form');
  proForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('pro-name').value.trim();
    const email = document.getElementById('pro-email').value.trim();
    const role = document.getElementById('pro-role').value.trim();
    if (!name) return;
    const r = await fetch('/api/professionals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role })
    });
    if (!r.ok) return alert('Erro ao salvar profissional');
    document.getElementById('pro-name').value='';
    document.getElementById('pro-email').value='';
    document.getElementById('pro-role').value='';
    await loadProfessionals();
    await refreshKPIs();
  });

  const allocForm = document.getElementById('alloc-form');
  allocForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      project_id: document.getElementById('alloc-project').value,
      professional_id: document.getElementById('alloc-professional').value,
      hours: Number(document.getElementById('alloc-hours').value || 0),
      start_date: document.getElementById('alloc-start').value || null,
      end_date: document.getElementById('alloc-end').value || null
    };
    const r = await fetch('/api/allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return alert('Erro ao criar alocação');
    allocForm.reset();
    await loadAllocations();
    await refreshKPIs();
  });
});

async function loadProjects() {
  const tbody = document.querySelector('#tbl-projects tbody');
  const empty = document.getElementById('projects-empty');
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) { console.error(error); return; }
  tbody.innerHTML = '';
  if (!data || data.length === 0) { empty.classList.remove('hidden'); return; } else { empty.classList.add('hidden'); }
  const projSelect = document.getElementById('alloc-project');
  projSelect.innerHTML='';
  for (const p of data) {
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `
      <td class="py-2 pr-4">${escapeHtml(p.name || '')}</td>
      <td class="py-2 pr-4">${escapeHtml(p.external_id || '')}</td>
      <td class="py-2 pr-4">${escapeHtml(p.status || '')}</td>
      <td class="py-2 pr-4">${escapeHtml(p.owner_email || '')}</td>
      <td class="py-2 pr-4">${p.created_at ? new Date(p.created_at).toLocaleString() : ''}</td>`;
    tbody.appendChild(tr);
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name || p.external_id;
    projSelect.appendChild(opt);
  }
}

async function loadProfessionals() {
  const list = document.getElementById('pro-list');
  const sel = document.getElementById('alloc-professional');
  sel.innerHTML='';
  const r = await fetch('/api/professionals');
  if (!r.ok) { list.innerHTML = '<li class="text-sm text-red-600">Erro ao carregar profissionais</li>'; return; }
  const arr = await r.json();
  list.innerHTML = '';
  arr.forEach(p => {
    const li = document.createElement('li');
    li.className = 'text-sm';
    li.textContent = `${p.name} ${p.email ? '· '+p.email : ''} ${p.role ? '· '+p.role : ''}`;
    list.appendChild(li);
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name + (p.role ? ' ('+p.role+')' : '');
    sel.appendChild(opt);
  });
}

async function loadAllocations() {
  const tbody = document.querySelector('#tbl-alloc tbody');
  tbody.innerHTML='';
  const r = await fetch('/api/allocations');
  if (!r.ok) { tbody.innerHTML = '<tr><td colspan="4" class="py-2 text-red-600">Erro ao carregar</td></tr>'; return; }
  const arr = await r.json();
  for (const a of arr) {
    const tr = document.createElement('tr');
    tr.className='border-b';
    tr.innerHTML = `
      <td class="py-2 pr-4">${escapeHtml(a.project_name || '')}</td>
      <td class="py-2 pr-4">${escapeHtml(a.professional_name || '')}</td>
      <td class="py-2 pr-4">${a.hours ?? 0}</td>
      <td class="py-2 pr-4">${a.start_date || ''} ${a.end_date ? ' → '+a.end_date : ''}</td>`;
    tbody.appendChild(tr);
  }
}

async function refreshKPIs() {
  const set = (id, v) => document.getElementById(id).textContent = v;
  const [{ count: pCount }, { count: profCount }, { count: aCount }] = await Promise.all([
    supabase.from('projects').select('*', { count:'exact', head:true }),
    supabase.from('professionals').select('*', { count:'exact', head:true }),
    supabase.from('allocations').select('*', { count:'exact', head:true }),
  ]);
  set('kpi-projects', pCount ?? 0);
  set('kpi-professionals', profCount ?? 0);
  set('kpi-allocations', aCount ?? 0);
}

function escapeHtml(s) { return (s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])); }
