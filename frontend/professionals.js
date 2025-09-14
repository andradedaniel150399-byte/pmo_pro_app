// professionals.js - carregamento e render básico de profissionais
(function () {
  async function loadProfessionals(force = false) {
    try {
      if (force || !window.state.db.professionals.length) {
        window.state.db.professionals = await window.fetchJSON('/api/professionals');
      }
      const tbody = document.getElementById('professionals-tbody');
      const selCreate = document.getElementById('alloc-prof');
      const selFilter = document.getElementById('filter-prof');
      if (!tbody || !selCreate) return;
      tbody.innerHTML = '';
      selCreate.innerHTML = '';
      if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';
      (window.state.db.professionals || []).forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="py-2 pr-4">${p.name}</td><td class="py-2 pr-4">${p.email ?? '-'}</td><td class="py-2">${p.role ?? '-'}</td>`;
        tbody.appendChild(tr);
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        selCreate.appendChild(opt);
        if (selFilter) selFilter.appendChild(opt.cloneNode(true));
      });
    } catch (e) {
      console.error('loadProfessionals', e);
      window.showNotification?.('Erro ao carregar profissionais', 'error');
    }
  }

  window.loadProfessionals = loadProfessionals;
})();
// professionals.js — carrega profissionais e popula UI
(function () {
  async function loadProfessionals(force = false) {
    try {
      if (force || !window.state.db.professionals.length) {
        window.state.db.professionals = await window.fetchJSON('/api/professionals');
      }
      const tbody = document.getElementById('professionals-tbody');
      const selCreate = document.getElementById('alloc-prof');
      const selFilter = document.getElementById('filter-prof');
      if (!tbody || !selCreate) return;
      tbody.innerHTML = '';
      selCreate.innerHTML = '';
      if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';
      (window.state.db.professionals || []).forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="py-2 pr-4">${p.name}</td><td class="py-2 pr-4">${p.email ?? '-'}</td><td class="py-2">${p.role ?? '-'}</td>`;
        tbody.appendChild(tr);
        const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; selCreate.appendChild(opt);
        if (selFilter) selFilter.appendChild(opt.cloneNode(true));
      });
    } catch (e) {
      console.error('loadProfessionals', e);
      window.showNotification?.('Erro ao carregar profissionais', 'error');
    }
  }

  window.loadProfessionals = loadProfessionals;
})();
