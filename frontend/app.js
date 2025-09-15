
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
      const j = await fetchJSON('/api/projects');
      state.db.projects = j.data || j || [];
    }
    const tbody = document.getElementById('projects-tbody');
    const selCreate = document.getElementById('alloc-project');
    const selFilter = document.getElementById('filter-project');
    if (!tbody || !selCreate) return;
    
    // Check if empty
    if(state.db.projects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-xs text-zinc-500 py-6">Nenhum projeto ainda. <button onclick="window.showNotification?.(\'Use o botão Sincronizar Pipefy\',\'info\')" class="text-blue-500 underline ml-1">Sincronizar dados</button></td></tr>';
      selCreate.innerHTML = '<option value="">Nenhum projeto</option>';
      if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';
      return;
    }
    
    tbody.innerHTML = '';
    selCreate.innerHTML = '';
    if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';
    (state.db.projects || []).forEach(p => {
      const tr = document.createElement('tr');
      // Add priority color coding
      const priorityClass = p.pipefy_priority === 'high' ? 'text-red-600' : 
                           p.pipefy_priority === 'medium' ? 'text-yellow-600' : 
                           p.pipefy_priority === 'low' ? 'text-green-600' : '';
      tr.innerHTML = `<td class=\"py-2 pr-4\">${p.name ?? '-'} </td><td class=\"py-2 pr-4\">${p.id ?? '-'}</td><td class=\"py-2 pr-4 ${priorityClass}\">${p.pipefy_status || p.status || '-'}</td><td class=\"py-2 pr-4\">${p.pipefy_owner_email || p.owner_email || '-'}</td><td class=\"py-2\">${(p.created_at || '').slice(0,10)}</td>`;
      tbody.appendChild(tr);
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || p.id;
      selCreate.appendChild(opt);
      if (selFilter) selFilter.appendChild(opt.cloneNode(true));
    });
  } catch (e) {
    console.error('loadProjects', e);
    const tbody = document.getElementById('projects-tbody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-xs text-red-400 py-4">Falha ao carregar projetos <button onclick="window.loadProjects?.(true)" class="text-blue-500 underline ml-1">Tentar novamente</button></td></tr>';
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
      tr.innerHTML = `<td class="py-2 pr-4">${p.name}</td><td class="py-2 pr-4">${p.email ?? '-'}</td><td class="py-2 pr-4">${p.role ?? '-'}</td><td class="py-2">${formatHourly(p.hourly_rate)}</td>`;
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

  function formatHourly(v) {
    if (v === undefined || v === null) return '-';
    const n = Number(v);
    if (!Number.isFinite(n)) return '-';
    return n.toFixed(2);
  }
  // export small helper for other modules
  window.formatHourly = window.formatHourly || formatHourly;
// professional creation modal & submit are handled by frontend/professionals.js

// --- autenticação/demo ---
let currentUser = null;

function loadUser() {
  try {
    currentUser = JSON.parse(localStorage.getItem('demoUser') || 'null');
  } catch {
    currentUser = null;
  }
}

function handleLogin() {
  currentUser = {
    name: 'Usuário Demo',
    avatar: `https://i.pravatar.cc/40?u=demo`
  };
  localStorage.setItem('demoUser', JSON.stringify(currentUser));
  showNotification(`Bem-vindo, ${currentUser.name}!`, 'success');
  renderAuthUI();
}

function renderAuthUI() {
  const avatarEl = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-name');
  const userInfo = document.getElementById('user-info');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const btnSync = document.getElementById('btnSync');
  const btnTheme = document.getElementById('btnTheme');
  const btnPersonalize = document.getElementById('btnPersonalize');

  if (currentUser?.name) {
    if (avatarEl) avatarEl.src = currentUser.avatar;
    if (nameEl) nameEl.textContent = currentUser.name;
    userInfo?.classList.remove('hidden');
    btnLogin?.classList.add('hidden');
    btnLogout?.classList.remove('hidden');
    btnSync?.classList.remove('hidden');
    btnTheme?.classList.remove('hidden');
    btnPersonalize?.classList.remove('hidden');
  } else {
    userInfo?.classList.add('hidden');
    btnLogin?.classList.remove('hidden');
    btnLogout?.classList.add('hidden');
    btnSync?.classList.add('hidden');
    btnTheme?.classList.add('hidden');
    btnPersonalize?.classList.add('hidden');
  }
}

// --- eventos ---
document.getElementById('btnLogin')?.addEventListener('click', handleLogin);
document.getElementById('btnPersonalize')?.addEventListener('click', () => {
  location.href = '/settings.html';
});
document.getElementById('btnTheme')?.addEventListener('click', () => {
  const html = document.documentElement;
  html.classList.toggle('dark');
  localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
});

// carrega listas e estado ao abrir
loadUser();
renderAuthUI();
const savedTheme = localStorage.getItem('theme');
if (savedTheme) document.documentElement.classList.toggle('dark', savedTheme === 'dark');
loadProjects();
loadProfessionals();
// expõe para o dashboard.js poder recarregar junto após sync
window.loadProjects = loadProjects;

async function init() {
  const endpoints = [
    ['overview', '/api/metrics/overview'],
    ['timeseries', '/api/metrics/timeseries?days=30'],
    ['professionals', '/api/professionals'],
    ['allocations', '/api/allocations']
  ];

  const results = await Promise.allSettled(endpoints.map(([, url]) => fetchJSON(url)));
  results.forEach((res, i) => {
    const key = endpoints[i][0];
    if (res.status === 'fulfilled') {
      const data = res.value;
      state.db[key] = data;
    } else {
      showNotification(`Erro ao carregar ${key}`, 'error');
    }
  });

  await loadProjects();
  await loadProfessionals();
  if (typeof window.populateAllocationSelects === 'function') window.populateAllocationSelects();
  if (typeof window.loadAllocations === 'function') window.loadAllocations();
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

});

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