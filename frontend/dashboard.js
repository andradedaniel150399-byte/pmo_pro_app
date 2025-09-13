/*
  PMO Pro — dashboard.js
  -------------------------------------------------------------
  O que este arquivo espera encontrar no HTML (ids/classes):
  - Botões de visão: .view-btn  (data-view="executivo|gerencial|personalizado")
  - Tabs (se usar): .tab-btn com data-tab e painéis .tab-panel (id igual ao data-tab)
  - KPIs:    #kpi-total, #kpi-last30, #kpi-owners, #kpi-hours
  - Gráficos: <canvas id="chartStatus"></canvas>, <canvas id="chartSeries"></canvas>
  - Tabela:  <tbody id="top-projects-tbody"></tbody>
  - Filtros opcionais (se existirem): 
      #filterRange (7|30|90), #filterOwner (email), #filterStatus (texto)
  - Botões de ação: #btnSync (sincronizar Pipefy) e #btnLogout (sair)
  -------------------------------------------------------------
  Dica: coloque este arquivo no final do <body> do seu app.html
  para garantir que o DOM já exista quando o script rodar.
*/

(() => {
  'use strict';

  // ---------- Helpers ---------- //
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Alterna estado de "carregando" em botões/containers
  function setLoading(el, on) {
    if (!el) return;
    if (on) {
      el.setAttribute('aria-busy', 'true');
      el.classList.add('opacity-60', 'pointer-events-none');
    } else {
      el.removeAttribute('aria-busy');
      el.classList.remove('opacity-60', 'pointer-events-none');
    }
  }

  // Toast básico (fallback em alert)
  function toast(msg, type='info') {
    if (typeof showNotification === 'function') {
      showNotification(msg, type === 'error' ? 'error' : type);
    } else {
      console[type === 'error' ? 'error' : 'log']('[toast]', msg);
      if (type === 'error') alert(msg);
    }
  }

  // Constrói querystring ignorando falsy
  const toQuery = (obj={}) => {
    const params = new URLSearchParams();
    Object.entries(obj).forEach(([k,v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, v);
    });
    const s = params.toString();
    return s ? `?${s}` : '';
  };

  // Cache leve em sessionStorage (TTL)
  const cacheGet = (key) => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { t, ttl, data } = JSON.parse(raw);
      if (Date.now() - t > ttl) return null;
      return data;
    } catch { return null; }
  };
  const cacheSet = (key, data, ttl=30_000) => {
    try {
      sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), ttl, data }));
    } catch {}
  };

  async function fetchJSON(path, opts={}) {
    const key = `cache:${path}:${opts.method||'GET'}`;
    if ((opts.cache ?? 'hit') === 'hit') {
      const hit = cacheGet(key);
      if (hit) return hit;
    }
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    if ((opts.cache ?? 'hit') === 'hit') cacheSet(key, data);
    return data;
  }

  // Garante Chart.js
  async function ensureChartJs() {
    if (typeof window.Chart !== 'undefined') return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Falha ao carregar Chart.js'));
      document.head.appendChild(s);
    });
  }

  // ---------- Estado ---------- //
  const state = {
    currentView: localStorage.getItem('pmo:view') || 'executivo',
    currentRange: localStorage.getItem('pmo:range') || '30', // dias
    filters: {
      owner: '',
      status: ''
    },
    charts: {
      status: null,
      series: null
    }
  };

  function persistState() {
    localStorage.setItem('pmo:view', state.currentView);
    localStorage.setItem('pmo:range', state.currentRange);
  }

  // ---------- UI Wiring ---------- //
  function bindTabs() {
    $$('.tab-btn').forEach(btn => {
      on(btn, 'click', () => {
        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-tab');
        $$('.tab-panel').forEach(p => p.classList.add('hidden'));
        const panel = document.getElementById(target);
        panel && panel.classList.remove('hidden');
      });
    });
  }

  function bindViewButtons() {
    $$('.view-btn').forEach(btn => {
      const view = btn.getAttribute('data-view');
      if (view === state.currentView) btn.classList.add('active');
      on(btn, 'click', async () => {
        $$('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentView = view;
        persistState();
        await refreshAll();
      });
    });
  }

  function bindFilters() {
    const rangeEl  = $('#filterRange');
    const ownerEl  = $('#filterOwner');
    const statusEl = $('#filterStatus');

    if (rangeEl) {
      rangeEl.value = state.currentRange;
      on(rangeEl, 'change', async () => {
        state.currentRange = String(rangeEl.value || '30');
        persistState();
        await Promise.all([loadSeries(), loadTopProjects()]);
      });
    }
    if (ownerEl) {
      on(ownerEl, 'change', async () => {
        state.filters.owner = ownerEl.value.trim();
        await refreshAll();
      });
    }
    if (statusEl) {
      on(statusEl, 'change', async () => {
        state.filters.status = statusEl.value.trim();
        await refreshAll();
      });
    }
  }

  function bindActions() {
    const btnSync   = $('#btnSync');
    const btnLogout = $('#btnLogout');

    on(btnSync, 'click', () => {
      confirmAction('Sincronizar Pipefy → Projetos?', async () => {
        try {
          setLoading(btnSync, true);
          const r = await fetchJSON('/api/sync/pipefy', { method: 'POST', cache: 'miss' });
          showNotification(`Sincronizado: ${r.upserts ?? 0} projeto(s)`, 'success');
          // limpar cache de métricas para refletir sincronização
          sessionStorage.clear();
          await refreshAll();
          // se a página principal tem window.loadProjects, recarrega lista
          if (typeof window.loadProjects === 'function') await window.loadProjects();
        } catch (e) {
          showNotification(`Erro ao sincronizar: ${e.message}`, 'error');
        } finally {
          setLoading(btnSync, false);
        }
      });
    });

    on(btnLogout, 'click', () => {
      confirmAction('Deseja sair?', () => {
        // Caso você use Supabase Auth no front, adicione o signOut aqui.
        localStorage.removeItem('demoUser');
        location.href = '/';
      });
    });
  }

  function bindShortcuts() {
    const btnCreate = $('#btnCreateProject');
    on(btnCreate, 'click', () => {
      const tabBtn = document.querySelector('[data-tab="tab-projects"]');
      tabBtn && tabBtn.click();
    });
  }

  // ---------- Renderização ---------- //
  function setKpi(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = (val ?? 0).toLocaleString('pt-BR');
  }

  async function loadOverview() {
    try {
      setKpi('kpi-total', '...');
      setKpi('kpi-last30', '...');
      setKpi('kpi-owners', '...');
      setKpi('kpi-hours', '...');

      const q = toQuery({
        view: state.currentView,
        owner: state.filters.owner,
        status: state.filters.status
      });
      const j = await fetchJSON(`/api/metrics/overview${q}`);

      setKpi('kpi-total',  j.total_projects);
      setKpi('kpi-last30', j.projects_last_30d);
      setKpi('kpi-owners', j.owners);
      setKpi('kpi-hours',  j.total_hours);

      const summary = $('#dashboard-summary');
      if (summary) {
        const total = (j.total_projects ?? 0).toLocaleString('pt-BR');
        const hours = (j.total_hours ?? 0).toLocaleString('pt-BR');
        summary.textContent = `${total} projetos, ${hours}h alocadas`;
      }

      await ensureChartJs();

      const labels = Object.keys(j.by_status || {});
      const values = labels.map(k => j.by_status[k]);

      const ctx = $('#chartStatus');
      if (ctx) {
        if (state.charts.status) state.charts.status.destroy();
        state.charts.status = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Projetos', data: values }] },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
      }
    } catch (e) {
      console.error('[overview]', e);
      toast('Falha ao carregar visão geral', 'error');
    }
  }

  async function loadSeries() {
    try {
      const q = toQuery({
        days: state.currentRange,
        view: state.currentView,
        owner: state.filters.owner,
        status: state.filters.status
      });
      const j = await fetchJSON(`/api/metrics/timeseries${q}`);

      await ensureChartJs();
      const ctx = $('#chartSeries');
      if (ctx) {
        if (state.charts.series) state.charts.series.destroy();
        state.charts.series = new Chart(ctx, {
          type: 'line',
          data: {
            labels: j.labels || [],
            datasets: [{ label: 'Novos projetos', data: j.values || [], tension: 0.3, fill: false }]
          },
          options: { responsive: true }
        });
      }
    } catch (e) {
      console.error('[series]', e);
      toast('Falha ao carregar séries', 'error');
    }
  }

  async function loadTopProjects() {
    try {
      const q = toQuery({
        limit: 10,
        view: state.currentView,
        owner: state.filters.owner,
        status: state.filters.status
      });
      const j = await fetchJSON(`/api/metrics/top-projects${q}`);
      const tbody = $('#top-projects-tbody');
      if (!tbody) return;
      tbody.innerHTML = '';

      (j.items || []).forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-2 pr-4">${p.name ?? '-'}</td>
          <td class="py-2 pr-4">${p.status ?? '-'}</td>
          <td class="py-2 pr-4">${p.owner_email ?? '-'}</td>
          <td class="py-2 text-right">${(p.hours ?? 0).toLocaleString('pt-BR')}</td>
        `;
        tbody.appendChild(tr);
      });

      // Export CSV (se existir botão #btnExportTop)
      const exportBtn = $('#btnExportTop');
      if (exportBtn) {
        on(exportBtn, 'click', () => exportCSV('top-projects.csv', j.items || []));
      }
    } catch (e) {
      console.error('[top-projects]', e);
      toast('Falha ao carregar Top Projetos', 'error');
    }
  }

  function exportCSV(filename, rows) {
    if (!rows?.length) return toast('Sem dados para exportar');
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(';'),
      ...rows.map(r => headers.map(h => String(r[h] ?? '').replaceAll(';', ',')).join(';'))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function refreshAll() {
    await loadOverview();
    await loadSeries();
    await loadTopProjects();
  }

  // ---------- Init ---------- //
  async function init() {
    bindTabs();
    bindViewButtons();
    bindFilters();
    bindActions();
    bindShortcuts();
    await refreshAll();

    // Auto-refresh leve (opcional). Ajuste o tempo se quiser.
    // Desabilite se não precisar.
    let ticking = false;
    setInterval(async () => {
      if (ticking) return;
      try {
        ticking = true;
        await refreshAll();
      } finally {
        ticking = false;
      }
    }, 60_000); // 60s
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // Exponha para debugging
  window.PMODashboard = {
    state,
    refreshAll,
    loadOverview,
    loadSeries,
    loadTopProjects
  };
})();