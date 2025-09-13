// Simple dashboard with customizable widgets
(() => {
  'use strict';

  const WIDGETS = {
    revenueStatus: {
      title: 'Revenue Status',
      render: renderRevenueStatusChart
    },
    utilization: {
      title: 'Utilization',
      render: renderUtilizationChart
    }
  };

  const STORAGE_KEY = 'pmo:dashboardLayout';

  const state = {
    dashboardLayout: loadLayout(),
    sortable: null
  };

  function loadLayout() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [
      { id: 'revenueStatus', size: 'sm', enabled: true },
      { id: 'utilization', size: 'sm', enabled: true }
    ];
  }

  function persistLayout() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.dashboardLayout));
    } catch (e) {}
  }

  function ensureContainer() {
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
    const cont = ensureContainer();
    cont.innerHTML = '';

    state.dashboardLayout.filter(w => w.enabled).forEach(w => {
      const meta = WIDGETS[w.id];
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

    initSortable(cont);
  }

  async function initSortable(cont) {
    await ensureSortable();
    if (state.sortable) state.sortable.destroy();
    state.sortable = new Sortable(cont, {
      animation: 150,
      handle: '.drag-handle',
      onEnd: () => {
        const order = Array.from(cont.children).map(el => el.dataset.id);
        state.dashboardLayout.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        persistLayout();
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
          persistLayout();
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
          persistLayout();
          renderDashboard();
          renderCustomizeMenu();
        }
      });
    }

  menu.innerHTML = '<h3 class="font-semibold mb-2">Widgets</h3>';
  state.dashboardLayout.forEach(w => {
    const meta = WIDGETS[w.id];
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
    await ensureChartJs();
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
    await ensureChartJs();
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

  async function ensureChartJs() {
    if (window.Chart) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureSortable() {
    if (window.Sortable) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function init() {
    renderDashboard();
    renderCustomizeMenu();
    loadTopProjects();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // expose for debugging
  window.PMODashboard = { state, renderDashboard };
})();

