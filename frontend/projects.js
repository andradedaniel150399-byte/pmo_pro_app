// projects.js - carregamento e render básico de projetos
(function () {
  async function loadProjects(force = false) {
    try {
      if (force || !window.state.db.projects.length) {
        const j = await window.fetchJSON('/api/metrics/top-projects?limit=999');
        window.state.db.projects = j.items || [];
      }
      const tbody = document.getElementById('projects-tbody');
      const selCreate = document.getElementById('alloc-project');
      const selFilter = document.getElementById('filter-project');
      if (!tbody || !selCreate) return;
      tbody.innerHTML = '';
      selCreate.innerHTML = '';
      if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';
      (window.state.db.projects || []).forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-2 pr-4">${p.name ?? '-'}</td>
          <td class="py-2 pr-4">${p.id ?? '-'}</td>
          <td class="py-2 pr-4">${p.status ?? '-'}</td>
          <td class="py-2 pr-4">${p.owner_email ?? '-'}</td>
          <td class="py-2">${(p.created_at || '').slice(0,10)}</td>
        `;
        tbody.appendChild(tr);
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name || p.id;
        selCreate.appendChild(opt);
        if (selFilter) selFilter.appendChild(opt.cloneNode(true));
      });
    } catch (e) {
      console.error('loadProjects', e);
      window.showNotification?.('Erro ao carregar projetos', 'error');
    }
  }

  window.loadProjects = loadProjects;
})();
// projects.js — carrega e renderiza lista de projetos e selects
(function () {
  async function loadProjects(force = false) {
    try {
      if (force || !window.state.db.projects.length) {
        const j = await window.fetchJSON('/api/metrics/top-projects?limit=999');
        window.state.db.projects = j.items || [];
      }
      const tbody = document.getElementById('projects-tbody');
      const selCreate = document.getElementById('alloc-project');
      const selFilter = document.getElementById('filter-project');
      if (!tbody || !selCreate) return;
      tbody.innerHTML = '';
      selCreate.innerHTML = '';
      if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';
      (window.state.db.projects || []).forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-2 pr-4">${p.name ?? '-'}</td>
          <td class="py-2 pr-4">${p.id ?? '-'}</td>
          <td class="py-2 pr-4">${p.status ?? '-'}</td>
          <td class="py-2 pr-4">${p.owner_email ?? '-'}</td>
          <td class="py-2">${(p.created_at || '').slice(0,10)}</td>
        `;
        tbody.appendChild(tr);
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.name || p.id; selCreate.appendChild(opt);
        if (selFilter) selFilter.appendChild(opt.cloneNode(true));
      });
    } catch (e) {
      console.error('loadProjects', e);
      window.showNotification?.('Erro ao carregar projetos', 'error');
    }
  }

  window.loadProjects = loadProjects;
})();
