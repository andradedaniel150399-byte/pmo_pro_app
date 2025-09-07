// Funções de listagem e criação de alocações
async function loadAllocations(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.project_id) params.append('project_id', filters.project_id);
    if (filters.professional_id) params.append('professional_id', filters.professional_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    const qs = params.toString();
    const r = await fetch('/api/allocations' + (qs ? `?${qs}` : ''));
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

function applyAllocationFilters() {
  const project_id = document.getElementById('filter-project')?.value || '';
  const professional_id = document.getElementById('filter-prof')?.value || '';
  const start_date = document.getElementById('filter-start')?.value || '';
  const end_date = document.getElementById('filter-end')?.value || '';
  loadAllocations({ project_id, professional_id, start_date, end_date });
}

document.getElementById('btnCreateAlloc')?.addEventListener('click', createAllocation);
document.getElementById('btnFilterAlloc')?.addEventListener('click', applyAllocationFilters);

loadAllocations();
window.loadAllocations = loadAllocations;

