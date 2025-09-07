// Gestão de projetos: listar, filtrar, criar e editar
async function loadProjects() {
  const search = document.getElementById('project-filter')?.value.trim() || '';
  try {
    const url = '/api/projects' + (search ? `?search=${encodeURIComponent(search)}` : '');
    const r = await fetch(url);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');

    const tbody = document.getElementById('projects-tbody');
    const sel = document.getElementById('alloc-project');
    if (tbody) tbody.innerHTML = '';
    if (sel) sel.innerHTML = '';

    (j || []).forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2 pr-4">${p.name ?? '-'}</td>
        <td class="py-2 pr-4">${p.external_id ?? '-'}</td>
        <td class="py-2 pr-4">${p.status ?? '-'}</td>
        <td class="py-2 pr-4">${p.owner_email ?? '-'}</td>
        <td class="py-2 pr-4">${(p.created_at || '').slice(0,10)}</td>
        <td class="py-2"><button class="btn-primary text-xs" data-id="${p.id}">Editar</button></td>
      `;
      tbody && tbody.appendChild(tr);

      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || p.id;
      sel && sel.appendChild(opt);
    });

    document.querySelectorAll('#projects-tbody button[data-id]')
      .forEach(btn => btn.addEventListener('click', () => editProject(btn.dataset.id)));
  } catch (e) {
    console.error('loadProjects', e);
  }
}

async function createProject() {
  const name = prompt('Nome do projeto:');
  if (!name) return;
  const external_id = prompt('External ID:') || '';
  const status = prompt('Status:') || '';
  const owner_email = prompt('Owner (email):') || '';
  try {
    const r = await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, external_id, status, owner_email })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');
    await loadProjects();
    alert('Projeto criado!');
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function editProject(id) {
  if (!id) return;
  const name = prompt('Nome do projeto:');
  if (!name) return;
  const status = prompt('Status:') || '';
  const owner_email = prompt('Owner (email):') || '';
  try {
    const r = await fetch(`/api/projects/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, status, owner_email })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');
    await loadProjects();
    alert('Projeto atualizado!');
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

let filterTimer;
document.getElementById('project-filter')?.addEventListener('input', () => {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(loadProjects, 300);
});

document.getElementById('btnNewProject')?.addEventListener('click', createProject);

// expõe para outros módulos
window.loadProjects = loadProjects;
