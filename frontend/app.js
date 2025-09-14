
// Estado global simples da aplicação
const state = (window.state = window.state || {
  theme: localStorage.getItem('theme') || 'light',
  // manter nomenclatura compatível com o UI existente
  currentUser: null,
  db: {
    projects: [],
    professionals: [],
    allocations: [],
    overview: null,
    timeseries: null
  }
});

window.state = state;

// Pequeno utilitário para fetch + JSON e tratamento de erros
async function fetchJSON(url) {
  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}
// app.js — entrypoint leve para inicialização da UI e ligação entre módulos

window.state = window.state || { theme: localStorage.getItem('theme') || 'light', user: null, db: { projects: [], professionals: [], allocations: [], comments: [], overview: null, timeseries: null }, charts: {}, dashboardLayout: [], capacityData: [] };
function switchView(viewId) {
  document.querySelectorAll('.tab-panel').forEach(sec => {
    const active = sec.id === viewId;
    sec.classList.toggle('hidden', !active);
    sec.classList.toggle('block', active);
  });
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === viewId));
}

function applyTheme() {
  window.state.theme = localStorage.getItem('theme') || 'light';
  const isDark = window.state.theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
}
function updateUserUI() {
  const infoEl = document.getElementById('user-info');
  const nameEl = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  if (infoEl) infoEl.classList.toggle('hidden', !state.currentUser);
  if (state.currentUser) {
    if (nameEl) nameEl.textContent = state.currentUser.email || state.currentUser.user_metadata?.full_name || '';
    if (avatarEl) avatarEl.src = state.currentUser.user_metadata?.avatar_url || '';
  } else {
    if (nameEl) nameEl.textContent = '';
    if (avatarEl) avatarEl.src = '';
  }
}
window.updateUserUI = updateUserUI;

// Carrega lista de projetos (aba Projetos) e preenche selects usados nas alocações
async function loadProjects(force = false) {
  try {
    if (force || !state.db.projects.length) {
      const j = await fetchJSON('/api/metrics/top-projects?limit=999');
      state.db.projects = j.items || [];
    }

    const tbody = document.getElementById('projects-tbody');
    const selCreate = document.getElementById('alloc-project');
    const selFilter = document.getElementById('filter-project');
    if (!tbody || !selCreate) return;
    tbody.innerHTML = '';
    selCreate.innerHTML = '';
    if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';

    (state.db.projects || []).forEach(p => {
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

      // selects
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || p.id;
      selCreate.appendChild(opt);
      if (selFilter) selFilter.appendChild(opt.cloneNode(true));
    });
  } catch (e) {
    console.error('loadProjects', e);
    showNotification('Erro ao carregar projetos', 'error');
  }
}

async function loadProfessionals(force = false) {
  try {
    if (force || !state.db.professionals.length) {
      state.db.professionals = await fetchJSON('/api/professionals');
    }

    const tbody = document.getElementById('professionals-tbody');
    const selCreate = document.getElementById('alloc-prof');
    const selFilter = document.getElementById('filter-prof');
    if (!tbody || !selCreate) return;
    tbody.innerHTML = '';
    selCreate.innerHTML = '';
    if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';

    (state.db.professionals || []).forEach(p => {
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
    showNotification('Erro ao carregar profissionais', 'error');
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
    state.db.professionals = []; // força recarga
    await loadProfessionals(true);
    alert('Profissional adicionado!');
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// expõe para o dashboard.js poder recarregar junto após sync
window.loadProjects = loadProjects;

async function init() {
  const endpoints = [
    ['overview', '/api/metrics/overview'],
    ['timeseries', '/api/metrics/timeseries?days=30'],
    ['projects', '/api/metrics/top-projects?limit=999'],
    ['professionals', '/api/professionals'],
    ['allocations', '/api/allocations']
  ];

  const results = await Promise.allSettled(endpoints.map(([, url]) => fetchJSON(url)));
  results.forEach((res, i) => {
    const key = endpoints[i][0];
    if (res.status === 'fulfilled') {
      const data = res.value;
      if (key === 'projects') state.db.projects = data.items || [];
      else state.db[key] = data;
    } else {
      showNotification(`Erro ao carregar ${key}`, 'error');
    }
  });

  await loadProjects();
  await loadProfessionals();
  if (window.renderProfitability) window.renderProfitability();
  if (window.PMODashboard?.renderDashboard) window.PMODashboard.renderDashboard();
}

// Navegação por hash para permitir links diretos para abas
document.addEventListener('DOMContentLoaded', () => {
  updateUserUI();
  restoreSession().then(session => {
    if (!session) window.location.replace('index.html');
  });

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await endSession();
    window.location.replace('index.html');
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.tab;
      switchView(view);
      location.hash = view;
    });
  });

  window.addEventListener('hashchange', () => {
    const view = location.hash.slice(1);
    if (view) switchView(view);
  });

  const initial = location.hash.slice(1) || 'tab-dashboard';
  switchView(initial);
  init();

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => { const view = btn.dataset.tab; switchView(view); location.hash = view; }));
  window.addEventListener('hashchange', () => { const view = location.hash.slice(1); if (view) switchView(view); });
  const initial = location.hash.slice(1) || 'tab-dashboard'; switchView(initial);
  applyTheme();

  // ligar botões principais a funções expostas pelos módulos
  document.getElementById('btnCreateAlloc')?.addEventListener('click', () => typeof window.createAllocation === 'function' && window.createAllocation());
  document.getElementById('btnFilterAlloc')?.addEventListener('click', () => typeof window.applyAllocationFilters === 'function' && window.applyAllocationFilters());
  document.getElementById('btnAnalyzeRisks')?.addEventListener('click', () => typeof window.analyzeRisks === 'function' && window.analyzeRisks());
  document.getElementById('btnCreateProject')?.addEventListener('click', () => window.showNotification?.('Funcionalidade Criar Projeto não implementada', 'info'));
  document.getElementById('btnSync')?.addEventListener('click', () => typeof window.handlePipefySync === 'function' ? window.handlePipefySync() : window.showNotification?.('Configurar Pipefy em Settings', 'info'));

  // chamada de inicialização de módulos (não-bloqueante)
  (async () => {
    try {
      if (typeof window.loadProjects === 'function') await window.loadProjects();
      if (typeof window.loadProfessionals === 'function') await window.loadProfessionals();
      if (typeof window.loadAllocations === 'function') await window.loadAllocations();
      if (typeof window.renderProfitability === 'function') window.renderProfitability();
      if (typeof window.renderKanban === 'function') window.renderKanban();
      if (typeof window.renderCapacityGapChart === 'function') window.renderCapacityGapChart();
    } catch (e) { console.error('initialization', e); }
  })();

});