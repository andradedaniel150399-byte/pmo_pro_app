// Consolidated frontend application logic

const state = window.state || {
  theme: localStorage.getItem('theme') || 'light',
  user: null,
  db: { projects: [], professionals: [], allocations: [], comments: [] },
  charts: {},
  dashboardLayout: [],
  sortable: null,
  capacityData: []
};

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

// ---------- Navigation ----------
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

function applyTheme() {
  state.theme = localStorage.getItem('theme') || 'light';
  const isDark = state.theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
}

// ---------- Data loading ----------
async function loadProjects() {
  try {
    const r = await fetch('/api/metrics/top-projects?limit=999');
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'erro');
    const tbody = document.getElementById('projects-tbody');
    const selCreate = document.getElementById('alloc-project');
    const selFilter = document.getElementById('filter-project');
    tbody.innerHTML = '';
    selCreate.innerHTML = '';
    if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';
    (j.items || []).forEach(p => {
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
    state.db.projects = j.items || [];
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
    const selCreate = document.getElementById('alloc-prof');
    const selFilter = document.getElementById('filter-prof');
    tbody.innerHTML = '';
    selCreate.innerHTML = '';
    if (selFilter) selFilter.innerHTML = '<option value="">Todos</option>';

    (j || []).forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="py-2 pr-4">${p.name}</td><td class="py-2 pr-4">${p.email ?? '-'}</td><td class="py-2">${p.role ?? '-'}</td>`;
      tbody.appendChild(tr);

      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      selCreate.appendChild(opt);
      if (selFilter) selFilter.appendChild(opt.cloneNode(true));
    });
    state.db.professionals = j || [];
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

window.loadProjects = loadProjects;

// ---------- Allocations ----------
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
    if (tbody) {
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
    }
    state.db.allocations = j || [];
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

// ---------- Planner ----------
function renderPlannerView() {
  const monthInput = document.querySelector('input[type="month"]');
  const table = document.getElementById('planner-table');
  if (!monthInput || !table) return;

  const monthValue = monthInput.value || new Date().toISOString().slice(0, 7);
  const [year, month] = monthValue.split('-').map(n => parseInt(n, 10));
  const daysInMonth = new Date(year, month, 0).getDate();

  table.innerHTML = '';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const thName = document.createElement('th');
  thName.textContent = 'Profissional';
  headRow.appendChild(thName);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const th = document.createElement('th');
    th.textContent = String(d);
    if (date.getDay() === 0 || date.getDay() === 6) th.classList.add('bg-slate-200');
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const allocations = state.db.allocations || [];
  const professionals = {};
  allocations.forEach(a => {
    const pid = a.professional_id ?? a.professional;
    const pname = a.professional_name ?? a.professional;
    if (pid && !professionals[pid]) professionals[pid] = pname || pid;
  });
  Object.entries(professionals).forEach(([pid, pname]) => {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.textContent = pname;
    tr.appendChild(nameTd);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cell = document.createElement('td');
      cell.className = 'text-center text-xs';
      const dow = new Date(year, month - 1, d).getDay();
      if (dow === 0 || dow === 6) cell.classList.add('bg-slate-100');
      const dayAllocs = allocations.filter(a => (a.professional_id ?? a.professional) == pid && (a.date || a.day) === dateStr);
      if (dayAllocs.length) {
        const hard = dayAllocs.reduce((s, a) => s + (a.hard ?? a.hard_hours ?? 0), 0);
        const soft = dayAllocs.reduce((s, a) => s + (a.soft ?? a.soft_hours ?? 0), 0);
        if (hard) {
          const spanHard = document.createElement('div');
          spanHard.textContent = hard;
          spanHard.className = 'bg-red-100 text-red-700';
          cell.appendChild(spanHard);
        }
        if (soft) {
          const spanSoft = document.createElement('div');
          spanSoft.textContent = soft;
          spanSoft.className = 'bg-green-100 text-green-700';
          cell.appendChild(spanSoft);
        }
      }
      tr.appendChild(cell);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

// ---------- Dashboard ----------
const DASHBOARD_STORAGE_KEY = 'dashboard_layout';
const DASHBOARD_WIDGETS = {
  revenueStatus: { title: 'Revenue Status', render: renderRevenueStatusChart },
  utilization: { title: 'Utilization', render: renderUtilizationChart }
};

function loadDashboardLayout() {
  try {
    const raw = localStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [
    { id: 'revenueStatus', size: 'sm', enabled: true },
    { id: 'utilization', size: 'sm', enabled: true }
  ];
}

function persistDashboardLayout() {
  try {
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(state.dashboardLayout));
  } catch (e) {}
}

function ensureDashboardContainer() {
  let cont = document.getElementById('dashboard-charts');
  if (!cont) {
    cont = document.createElement('section');
    cont.id = 'dashboard-charts';
    cont.className = 'grid grid-cols-1 lg:grid-cols-2 gap-4';
    document.body.appendChild(cont);
  }
  return cont;
}

function renderDashboard() {
  const cont = ensureDashboardContainer();
  cont.innerHTML = '';
  state.dashboardLayout.filter(w => w.enabled).forEach(w => {
    const meta = DASHBOARD_WIDGETS[w.id];
    if (!meta) return;
    const wrapper = document.createElement('div');
    wrapper.dataset.id = w.id;
    wrapper.className = `card p-4 ${w.size === 'lg' ? 'lg:col-span-2' : ''}`;
    wrapper.innerHTML = `<div class="flex items-center justify-between mb-2"><h2 class="font-semibold text-gray-900">${meta.title}</h2><span class="drag-handle cursor-move text-gray-400">⠿</span></div>`;
    const content = document.createElement('div');
    wrapper.appendChild(content);
    meta.render(content);
    cont.appendChild(wrapper);
  });
  initDashboardSortable(cont);
}

function initDashboardSortable(cont) {
  if (state.sortable) state.sortable.destroy();
  state.sortable = new Sortable(cont, {
    animation: 150,
    handle: '.drag-handle',
    onEnd: () => {
      const order = Array.from(cont.children).map(el => el.dataset.id);
      state.dashboardLayout.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      persistDashboardLayout();
    }
  });
}

function renderCustomizeMenu() {
  let menu = document.getElementById('dashboard-customize');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'dashboard-customize';
    menu.className = 'card p-4 space-y-2 absolute right-4 top-20 bg-white shadow hidden z-50';
    document.body.appendChild(menu);

    const btn = document.createElement('button');
    btn.id = 'btnCustomize';
    btn.textContent = 'Personalizar';
    btn.className = 'btn btn-soft mb-2';
    btn.addEventListener('click', () => menu.classList.toggle('hidden'));
    const top = document.getElementById('dashboard-top') || document.body;
    top.appendChild(btn);

    menu.addEventListener('change', e => {
      const id = e.target.dataset.id;
      const w = state.dashboardLayout.find(x => x.id === id);
      if (w) {
        w.enabled = e.target.checked;
        persistDashboardLayout();
        renderDashboard();
        renderCustomizeMenu();
      }
    });

    menu.addEventListener('click', e => {
      const btn = e.target.closest('.size-btn');
      if (!btn) return;
      const id = btn.dataset.id;
      const size = btn.dataset.size;
      const w = state.dashboardLayout.find(x => x.id === id);
      if (w) {
        w.size = size;
        persistDashboardLayout();
        renderDashboard();
        renderCustomizeMenu();
      }
    });
  }
  menu.innerHTML = '<h3 class="font-semibold mb-2">Widgets</h3>';
  state.dashboardLayout.forEach(w => {
    const meta = DASHBOARD_WIDGETS[w.id];
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between';
    row.innerHTML = `
      <label class="flex items-center gap-2">
        <input type="checkbox" data-id="${w.id}" ${w.enabled ? 'checked' : ''}/>
        ${meta.title}
      </label>
      <span class="space-x-1">
        <button class="size-btn px-2 py-1 rounded text-xs ${w.size === 'sm' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}" data-id="${w.id}" data-size="sm">Pequeno</button>
        <button class="size-btn px-2 py-1 rounded text-xs ${w.size === 'lg' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}" data-id="${w.id}" data-size="lg">Grande</button>
      </span>`;
    menu.appendChild(row);
  });
}

async function fetchJSON(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length) }]
    },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
}

async function renderUtilizationChart(root) {
  const series = await fetchJSON('/api/metrics/timeseries?days=30');
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: series.labels || [],
      datasets: [{
        label: 'Novos projetos',
        data: series.values || [],
        backgroundColor: '#4f46e5'
      }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
}

function initDashboard() {
  state.dashboardLayout = loadDashboardLayout();
  renderDashboard();
  renderCustomizeMenu();
  loadTopProjects();
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
      data: {
        labels: list.map(p => p.name || `#${p.id}`),
        datasets: [{
          label: 'Lucro',
          data: list.map(p => p.profit),
          backgroundColor: list.map(p => p.profit >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)')
        }]
      },
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
const statusColors = {
  'Em andamento': 'border-blue-500',
  'Concluído': 'border-green-500',
  'Atrasado': 'border-red-500'
};

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
    (state.db.projects || []).forEach(p => {
      const s = p.status || 'Sem status';
      (groups[s] = groups[s] || []).push(p);
    });
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
      new Sortable(cardsEl, {
        group: 'kanban',
        animation: 150,
        onEnd: evt => {
          const card = evt.item;
          const newStatus = evt.to.closest('.kanban-column').dataset.status;
          const proj = state.db.projects.find(pr => String(pr.id) === String(card.dataset.id));
          if (proj) proj.status = newStatus;
          fetch(`/api/projects/${card.dataset.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          }).catch(console.error);
        }
      });
    });
  } catch (e) {
    console.error('renderKanban', e);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderComments(projectId) {
  return (state.db.comments || [])
    .filter(c => String(c.project_id) === String(projectId))
    .map(c => `<div class="p-2 bg-slate-100 rounded">${escapeHtml(c.text)}</div>`)
    .join('');
}

async function openProjectModal(projectId) {
  const project = (state.db.projects || []).find(p => String(p.id) === String(projectId));
  if (!project) return;
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-xl p-6 max-w-lg w-full">
      <h2 class="text-lg font-semibold mb-4">${project.name || project.id}</h2>
      <div id="comments-list" class="flex flex-col gap-2 mb-4 max-h-60 overflow-y-auto">
        ${renderComments(projectId)}
      </div>
      <textarea id="comment-text" class="input mb-2" placeholder="Escreva um comentário"></textarea>
      <label class="flex items-center gap-2 mb-4">
        <input type="checkbox" id="notify-teams" />
        <span class="text-sm">Notificar no Teams</span>
      </label>
      <div class="flex justify-end gap-2">
        <button id="close-modal" class="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-sm">Fechar</button>
        <button id="send-comment" class="btn-primary">Enviar</button>
      </div>
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
      const div = document.createElement('div');
      div.className = 'p-2 bg-slate-100 rounded';
      div.textContent = text;
      list.appendChild(div);
      modal.querySelector('#comment-text').value = '';
    } catch (err) {
      console.error('send-comment', err);
    }
  });
}

async function callGeminiAPI(payload) {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || 'Erro ao chamar Gemini');
  return data;
}

// ---------- Capacity ----------
const DEFAULT_CAPACITY = 160;

async function loadCapacityData() {
  const [profRes, allocRes] = await Promise.all([
    fetch('/api/professionals'),
    fetch('/api/allocations')
  ]);
  const professionals = await profRes.json().catch(() => []);
  const allocations = await allocRes.json().catch(() => []);
  const hoursByProf = {};
  (allocations || []).forEach(a => {
    const pid = a.professional_id;
    hoursByProf[pid] = (hoursByProf[pid] || 0) + Number(a.hours || 0);
  });
  return (professionals || []).map(p => ({
    id: p.id,
    name: p.name || `ID ${p.id}`,
    allocated: hoursByProf[p.id] || 0,
    capacity: DEFAULT_CAPACITY
  }));
}

async function renderCapacityGapChart() {
  const ctx = document.getElementById('capacityGapChart');
  if (!ctx) return;
  state.capacityData = await loadCapacityData();
  const labels = state.capacityData.map(d => d.name);
  const allocated = state.capacityData.map(d => d.allocated);
  const available = state.capacityData.map(d => Math.max(0, d.capacity - d.allocated));
  if (state.charts.capacityGap) state.charts.capacityGap.destroy();
  state.charts.capacityGap = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Alocado', data: allocated, backgroundColor: 'rgba(59,130,246,0.8)', stack: 'stack1' },
        { label: 'Disponível', data: available, backgroundColor: 'rgba(16,185,129,0.8)', stack: 'stack1' }
      ]
    },
    options: {
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
    }
  });
}

async function analyzeRisks() {
  if (!state.capacityData.length) await renderCapacityGapChart();
  const summary = state.capacityData
    .map(d => `${d.name}: ${d.allocated}/${d.capacity}h`)
    .join('\n');
  try {
    const txt = await callGeminiAPI({ prompt: `Analise riscos de capacidade com base nos dados a seguir:\n${summary}` });
    const outEl = document.getElementById('riskAnalysisText');
    if (outEl) outEl.textContent = txt.text || txt.response || '';
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// ---------- Initialization ----------
document.addEventListener('DOMContentLoaded', () => {
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

  applyTheme();
  loadProjects();
  loadProfessionals();
  loadAllocations();
  renderPlannerView();
  initDashboard();
  renderProfitability();
  renderKanban();
  renderCapacityGapChart();

  document.getElementById('btnCreateAlloc')?.addEventListener('click', createAllocation);
  document.getElementById('btnFilterAlloc')?.addEventListener('click', applyAllocationFilters);
  document.querySelector('input[type="month"]')?.addEventListener('change', renderPlannerView);
  document.getElementById('btnAnalyzeRisks')?.addEventListener('click', analyzeRisks);
});

