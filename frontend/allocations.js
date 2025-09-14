// allocations.js - criar e listar alocações
(function () {
  async function loadAllocations() {
    try {
      const list = await window.fetchJSON('/api/allocations');
      window.state.db.allocations = list || [];
      const tbody = document.getElementById('allocations-tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      (window.state.db.allocations || []).forEach(a => {
        const tr = document.createElement('tr');
        const proj = (window.state.db.projects || []).find(p => String(p.id) === String(a.project_id));
        const prof = (window.state.db.professionals || []).find(p => String(p.id) === String(a.professional_id));
        tr.innerHTML = `<td class="py-2 pr-4">${proj?.name ?? a.project_id}</td><td class="py-2 pr-4">${prof?.name ?? a.professional_id}</td><td class="py-2 pr-4">${a.hours}</td><td class="py-2">${a.start} → ${a.end}</td>`;
        tbody.appendChild(tr);
      });
    } catch (e) { console.error('loadAllocations', e); }
  }

  async function createAllocation() {
    const project = document.getElementById('alloc-project')?.value;
    const prof = document.getElementById('alloc-prof')?.value;
    const hours = Number(document.getElementById('alloc-hours')?.value || 0);
    const start = document.getElementById('alloc-start')?.value;
    const end = document.getElementById('alloc-end')?.value;
    if (!project || !prof || !hours) return window.showNotification?.('Preencha projeto, profissional e horas', 'error');
    try {
      await fetch('/api/allocations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: project, professional_id: prof, hours, start, end }) });
      window.showNotification?.('Alocação criada', 'success');
      await loadAllocations();
    } catch (e) { console.error('createAllocation', e); window.showNotification?.('Erro ao criar alocação', 'error'); }
  }

  window.loadAllocations = loadAllocations;
  window.createAllocation = createAllocation;
})();
// allocations.js — gerencia criação e listagem de alocações
(function () {
  async function loadAllocations() {
    try {
      const arr = await window.fetchJSON('/api/allocations');
      window.state.db.allocations = arr || [];
      const tbody = document.getElementById('allocations-tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      (window.state.db.allocations || []).forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="py-2 pr-4">${a.project_name || a.project_id}</td><td class="py-2 pr-4">${a.professional_name || a.professional_id}</td><td class="py-2 pr-4">${a.hours || 0}</td><td class="py-2">${a.start || ''} - ${a.end || ''}</td>`;
        tbody.appendChild(tr);
      });
    } catch (e) { console.error('loadAllocations', e); }
  }

  async function createAllocation() {
    const project = document.getElementById('alloc-project')?.value;
    const prof = document.getElementById('alloc-prof')?.value;
    const hours = document.getElementById('alloc-hours')?.value;
    const start = document.getElementById('alloc-start')?.value;
    const end = document.getElementById('alloc-end')?.value;
    if (!project || !prof || !hours) return alert('Preencha projeto, profissional e horas');
    try {
      const r = await fetch('/api/allocations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: project, professional_id: prof, hours, start, end }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Erro');
      await loadAllocations();
      window.showNotification?.('Alocação criada', 'success');
    } catch (e) { alert('Erro: ' + e.message); }
  }

  window.loadAllocations = loadAllocations;
  window.createAllocation = createAllocation;
})();
