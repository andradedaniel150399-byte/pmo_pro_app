// Carrega lista de projetos (aba Projetos) e preenche selects usados nas alocações
async function loadProjects() {
  try {
    const r = await fetch('/api/metrics/top-projects?limit=999'); // pega ids e nomes (reuso)
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');

    // Se você quiser todos, troque por uma rota que liste /api/projects (você pode criar depois)
    // Aqui, para simplificar, uso os "top projects" só para preencher a tabela e selects.
    const tbody = document.getElementById('projects-tbody');
    const sel = document.getElementById('alloc-project');
    tbody.innerHTML = '';
    sel.innerHTML = '';

    (j.items || []).forEach(p => {
      // tabela
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2 pr-4">${p.name ?? '-'}</td>
        <td class="py-2 pr-4">${p.id ?? '-'}</td>
        <td class="py-2 pr-4">${p.status ?? '-'}</td>
        <td class="py-2 pr-4">${p.owner_email ?? '-'}</td>
        <td class="py-2">${(p.created_at || '').slice(0,10)}</td>
      `;
      tbody.appendChild(tr);

      // select
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || p.id;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error('loadProjects', e);
  }
}

async function loadProfessionals() {
  try {
    const r = await fetch('/api/professionals');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');

    const tbody = document.getElementById('professionals-tbody');
    const sel = document.getElementById('alloc-prof');
    tbody.innerHTML = '';
    sel.innerHTML = '';

    (j || []).forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="py-2 pr-4">${p.name}</td><td class="py-2 pr-4">${p.email ?? '-'}</td><td class="py-2">${p.role ?? '-'}</td>`;
      tbody.appendChild(tr);

      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error('loadProfessionals', e);
  }
}

async function addProfessional() {
  const name = document.getElementById('prof-name').value.trim();
  const email = document.getElementById('prof-email').value.trim();
  const role = document.getElementById('prof-role').value.trim();
  if (!name) return alert('Informe o nome');

  try {
    const r = await fetch('/api/professionals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');
    document.getElementById('prof-name').value = '';
    document.getElementById('prof-email').value = '';
    document.getElementById('prof-role').value = '';
    await loadProfessionals();
    alert('Profissional adicionado!');
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function loadAllocations() {
  try {
    const r = await fetch('/api/allocations');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');

    const tbody = document.getElementById('allocations-tbody');
    tbody.innerHTML = '';
    (j || []).forEach(a => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2 pr-4">${a.project_name ?? a.project_id}</td>
        <td class="py-2 pr-4">${a.professional_name ?? a.professional_id}</td>
        <td class="py-2 pr-4">${a.hours ?? 0}</td>
        <td class="py-2">${(a.start_date || '')} — ${(a.end_date || '')}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('loadAllocations', e);
  }
}

async function createAllocation() {
  const project_id = document.getElementById('alloc-project').value;
  const professional_id = document.getElementById('alloc-prof').value;
  const hours = Number(document.getElementById('alloc-hours').value || 0);
  const start_date = document.getElementById('alloc-start').value || null;
  const end_date = document.getElementById('alloc-end').value || null;
  if (!project_id || !professional_id) return alert('Selecione projeto e profissional');

  try {
    const r = await fetch('/api/allocations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id, professional_id, hours, start_date, end_date })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro ao criar alocação');
    await loadAllocations();
    alert('Alocação criada!');
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// eventos
document.getElementById('btnAddProf')?.addEventListener('click', addProfessional);
document.getElementById('btnCreateAlloc')?.addEventListener('click', createAllocation);

// carrega listas ao abrir
loadProjects();
loadProfessionals();
loadAllocations();

// expõe para o dashboard.js poder recarregar junto após sync
window.loadProjects = loadProjects;
