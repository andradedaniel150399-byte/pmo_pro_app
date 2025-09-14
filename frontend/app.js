// Consolidated frontend application logic (cleaned)

// Estado global único
const state = (window.state = window.state || {
  theme: localStorage.getItem('theme') || 'light',
  user: null,
  db: { projects: [], professionals: [], allocations: [], comments: [], overview: null, timeseries: null },
  charts: {},
  dashboardLayout: [],
  capacityData: []
});

// Requisições JSON com tratamento básico
async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText || `HTTP ${r.status}`);
  return data;
}

// ---------- UI helpers ----------
function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `notification notification-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function confirmAction(message, onConfirm, onCancel) {
  const modal = document.getElementById('confirmation-modal');
  const msgEl = document.getElementById('confirmation-message');
  const yesBtn = document.getElementById('confirm-yes');
  const noBtn = document.getElementById('confirm-no');
  if (!modal || !msgEl || !yesBtn || !noBtn) {
    if (confirm(message)) onConfirm?.(); else onCancel?.();
    return;
  }
  msgEl.textContent = message;
  modal.classList.remove('hidden');
  function cleanup() {
    modal.classList.add('hidden');
    yesBtn.removeEventListener('click', yesHandler);
    noBtn.removeEventListener('click', noHandler);
  }
  async function yesHandler() { cleanup(); await onConfirm?.(); }
  function noHandler() { cleanup(); onCancel?.(); }
  yesBtn.addEventListener('click', yesHandler);
  noBtn.addEventListener('click', noHandler);
}

// Alterna visualizações principais (tabs)
function switchView(viewId) {
  document.querySelectorAll('.tab-panel').forEach(sec => {
    const active = sec.id === viewId;
    sec.classList.toggle('hidden', !active);
    sec.classList.toggle('block', active);
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === viewId);
  });
}

// Aplica tema salvo
function applyTheme() {
  state.theme = localStorage.getItem('theme') || 'light';
  const isDark = state.theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
}

// ---------- Data loading ----------
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

function setKpi(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = (val ?? 0).toLocaleString('pt-BR');
}

async function loadOverview() {
  const data = await fetchJSON('/api/metrics/overview');
  setKpi('kpi-total', data.total_projects);
  setKpi('kpi-last30', data.projects_last_30d);
  setKpi('kpi-owners', data.owners);
  setKpi('kpi-hours', data.total_hours);
  return data;
}

async function loadTopProjects() {
  const tbody = document.getElementById('top-projects-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const j = await fetchJSON('/api/metrics/top-projects?limit=10');
  (j.items || []).forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="py-2 pr-4">${p.name ?? '-'}</td>
      <td class="py-2 pr-4">${p.status ?? '-'}</td>
      <td class="py-2 pr-4">${p.owner_email ?? '-'}</td>
      <td class="py-2 text-right">${(p.hours ?? 0).toLocaleString('pt-BR')}</td>`;
    tbody.appendChild(tr);
  });
}

async function renderRevenueStatusChart(root) {
  const overview = await loadOverview();
  const labels = Object.keys(overview.by_status || {});
  const values = labels.map(k => overview.by_status[k]);
  const colors = ['#c7d2fe', '#4f46e5', '#a5b4fc', '#818cf8', '#6366f1'];
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);
  new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length) }] },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
}

async function renderUtilizationChart(root) {
  const series = await fetchJSON('/api/metrics/timeseries?days=30');
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);
  new Chart(canvas, {
    type: 'bar',
    data: { labels: series.labels || [], datasets: [{ label: 'Novos projetos', data: series.values || [], backgroundColor: '#4f46e5' }] },
    options: { scales: { y: { beginAtZero: true } } }
  });
}

function initDashboard() {
  if (typeof loadDashboardLayout === 'function') state.dashboardLayout = loadDashboardLayout();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderCustomizeMenu === 'function') renderCustomizeMenu();
  if (typeof loadTopProjects === 'function') loadTopProjects();
}

// ---------- Profitability ----------
const fmtCurrency = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function buildProfitability() {
  const rateByProf = {};
  (state.db.professionals || []).forEach(p => {
    const rate = Number(p.hourly_rate ?? p.hour_cost ?? p.cost ?? p.rate ?? 0);
    rateByProf[p.id] = rate;
  });
  const costByProject = {};
  (state.db.allocations || []).forEach(a => {
    const rate = rateByProf[a.professional_id] || 0;
    const hours = Number(a.hours || 0);
    costByProject[a.project_id] = (costByProject[a.project_id] || 0) + hours * rate;
  });
  return (state.db.projects || []).map(p => {
    const revenue = Number(p.revenue ?? p.income ?? p.budget ?? 0);
    const cost = costByProject[p.id] || 0;
    const profit = revenue - cost;
    const margin = revenue ? profit / revenue : 0;
    return { ...p, revenue, cost, profit, margin };
  }).sort((a, b) => b.revenue - a.revenue);
}

async function renderProfitability() {
  const list = buildProfitability();
  const ctx = document.getElementById('profitabilityChart');
  if (ctx) {
    state.charts.profitability?.destroy?.();
    state.charts.profitability = new Chart(ctx, {
      type: 'bar',
      data: { labels: list.map(p => p.name || `#${p.id}`), datasets: [{ label: 'Lucro', data: list.map(p => p.profit), backgroundColor: list.map(p => p.profit >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)') }] },
      options: { scales: { y: { beginAtZero: true } } }
    });
  }
  const tbody = document.getElementById('profitabilityTable');
  if (tbody) {
    tbody.innerHTML = '';
    list.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2 pr-4">${p.name || p.id}</td>
        <td class="py-2 pr-4 text-right">${fmtCurrency(p.revenue)}</td>
        <td class="py-2 pr-4 text-right">${fmtCurrency(p.cost)}</td>
        <td class="py-2 pr-4 text-right">${fmtCurrency(p.profit)}</td>
        <td class="py-2 text-right font-semibold ${p.margin >= 0 ? 'text-green-600' : 'text-red-600'}">${(p.margin * 100).toFixed(1)}%</td>`;
      tbody.appendChild(tr);
    });
  }
}

// ---------- Kanban ----------
const statusColors = { 'Em andamento': 'border-blue-500', 'Concluído': 'border-green-500', 'Atrasado': 'border-red-500' };

async function renderKanban() {
  try {
    if (!state.db.projects.length) {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'erro ao carregar projetos');
      state.db.projects = data || [];
    }
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = '';
    const groups = {};
    (state.db.projects || []).forEach(p => { const s = p.status || 'Sem status'; (groups[s] = groups[s] || []).push(p); });
    Object.entries(groups).forEach(([status, items]) => {
      const col = document.createElement('div');
      col.className = 'kanban-column';
      col.dataset.status = status;
      col.innerHTML = `<div class="kanban-column-title">${status}</div><div class="kanban-column-cards"></div>`;
      board.appendChild(col);
      const cardsEl = col.querySelector('.kanban-column-cards');
      items.forEach(p => {
        const color = statusColors[p.status] || 'border-slate-300';
        const card = document.createElement('div');
        card.className = `kanban-card ${color}`;
        card.textContent = p.name || p.id;
        card.dataset.id = p.id;
        card.addEventListener('click', () => openProjectModal(p.id));
        cardsEl.appendChild(card);
      });
      if (typeof Sortable === 'function') {
        new Sortable(cardsEl, {
          group: 'kanban', animation: 150, onEnd: evt => {
            const card = evt.item;
            const newStatus = evt.to.closest('.kanban-column').dataset.status;
            const proj = state.db.projects.find(pr => String(pr.id) === String(card.dataset.id));
            if (proj) proj.status = newStatus;
            fetch(`/api/projects/${card.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }).catch(console.error);
          }
        });
      }
    });
  } catch (e) { console.error('renderKanban', e); }
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function renderComments(projectId) { return (state.db.comments || []).filter(c => String(c.project_id) === String(projectId)).map(c => `<div class="p-2 bg-slate-100 rounded">${escapeHtml(c.text)}</div>`).join(''); }

async function openProjectModal(projectId) {
  const project = (state.db.projects || []).find(p => String(p.id) === String(projectId));
  if (!project) return;
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-xl p-6 max-w-lg w-full">
      <h2 class="text-lg font-semibold mb-4">${project.name || project.id}</h2>
      <div id="comments-list" class="flex flex-col gap-2 mb-4 max-h-60 overflow-y-auto">${renderComments(projectId)}</div>
      <textarea id="comment-text" class="input mb-2" placeholder="Escreva um comentário"></textarea>
      <label class="flex items-center gap-2 mb-4"><input type="checkbox" id="notify-teams" /><span class="text-sm">Notificar no Teams</span></label>
      <div class="flex justify-end gap-2"><button id="close-modal" class="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-sm">Fechar</button><button id="send-comment" class="btn-primary">Enviar</button></div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#close-modal').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  modal.querySelector('#send-comment').addEventListener('click', async () => {
    const text = modal.querySelector('#comment-text').value.trim();
    const notify = modal.querySelector('#notify-teams').checked;
    if (!text) return;
    try {
      await callGeminiAPI({ projectId, text, notifyTeams: notify });
      state.db.comments = state.db.comments || [];
      state.db.comments.push({ project_id: projectId, text });
      const list = modal.querySelector('#comments-list');
      const div = document.createElement('div'); div.className = 'p-2 bg-slate-100 rounded'; div.textContent = text; list.appendChild(div);
      modal.querySelector('#comment-text').value = '';
    } catch (err) { console.error('send-comment', err); }
  });
}

async function callGeminiAPI(payload) {
  const res = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || 'Erro ao chamar Gemini');
  return data;
}

// ---------- Capacity ----------
const DEFAULT_CAPACITY = 160;

async function loadCapacityData() {
  const [profRes, allocRes] = await Promise.all([ fetch('/api/professionals'), fetch('/api/allocations') ]);
  const professionals = await profRes.json().catch(() => []);
  const allocations = await allocRes.json().catch(() => []);
  const hoursByProf = {};
  (allocations || []).forEach(a => { const pid = a.professional_id; hoursByProf[pid] = (hoursByProf[pid] || 0) + Number(a.hours || 0); });
  return (professionals || []).map(p => ({ id: p.id, name: p.name || `ID ${p.id}`, allocated: hoursByProf[p.id] || 0, capacity: DEFAULT_CAPACITY }));
}

async function renderCapacityGapChart() {
  const ctx = document.getElementById('capacityGapChart'); if (!ctx) return; state.capacityData = await loadCapacityData();
  const labels = state.capacityData.map(d => d.name); const allocated = state.capacityData.map(d => d.allocated); const available = state.capacityData.map(d => Math.max(0, d.capacity - d.allocated));
  if (state.charts.capacityGap) state.charts.capacityGap.destroy();
  state.charts.capacityGap = new Chart(ctx, { type: 'bar', data: { labels, datasets: [ { label: 'Alocado', data: allocated, backgroundColor: 'rgba(59,130,246,0.8)', stack: 'stack1' }, { label: 'Disponível', data: available, backgroundColor: 'rgba(16,185,129,0.8)', stack: 'stack1' } ] }, options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } } });
}

async function analyzeRisks() {
  if (!state.capacityData.length) await renderCapacityGapChart();
  const summary = state.capacityData.map(d => `${d.name}: ${d.allocated}/${d.capacity}h`).join('\n');
  try { const txt = await callGeminiAPI({ prompt: `Analise riscos de capacidade com base nos dados a seguir:\n${summary}` }); const outEl = document.getElementById('riskAnalysisText'); if (outEl) outEl.textContent = txt.text || txt.response || ''; } catch (e) { alert('Erro: ' + e.message); }
}

// ---------- Initialization ----------
async function init() {
  const endpoints = [ ['overview', '/api/metrics/overview'], ['timeseries', '/api/metrics/timeseries?days=30'], ['projects', '/api/metrics/top-projects?limit=999'], ['professionals', '/api/professionals'], ['allocations', '/api/allocations'] ];
  const results = await Promise.allSettled(endpoints.map(([, url]) => fetchJSON(url)));
  results.forEach((res, i) => {
    const key = endpoints[i][0];
    if (res.status === 'fulfilled') {
      const data = res.value;
      if (key === 'projects') state.db.projects = data.items || [];
      else state.db[key] = data;
    } else showNotification(`Erro ao carregar ${key}`, 'error');
  });
  await loadProjects(); await loadProfessionals();
  if (typeof renderProfitability === 'function') renderProfitability();
  if (window.PMODashboard?.renderDashboard) window.PMODashboard.renderDashboard();
}

// Navegação e inicialização do DOM
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => { const view = btn.dataset.tab; switchView(view); location.hash = view; }));
  window.addEventListener('hashchange', () => { const view = location.hash.slice(1); if (view) switchView(view); });
  const initial = location.hash.slice(1) || 'tab-dashboard'; switchView(initial);
  applyTheme();
  // Inicialização assíncrona principal
  init().catch(e => console.error('init', e));
  // Chamadas extras de setup caso existam
  if (typeof initDashboard === 'function') initDashboard();
  if (typeof renderProfitability === 'function') renderProfitability();
  if (typeof renderKanban === 'function') renderKanban();
  if (typeof renderCapacityGapChart === 'function') renderCapacityGapChart();
  // Event listeners opcionais (seguros)
  document.getElementById('btnCreateAlloc')?.addEventListener('click', () => typeof createAllocation === 'function' && createAllocation());
  document.getElementById('btnFilterAlloc')?.addEventListener('click', () => typeof applyAllocationFilters === 'function' && applyAllocationFilters());
  document.querySelector('input[type="month"]')?.addEventListener('change', () => typeof renderPlannerView === 'function' && renderPlannerView());
  document.getElementById('btnAnalyzeRisks')?.addEventListener('click', analyzeRisks);
});

