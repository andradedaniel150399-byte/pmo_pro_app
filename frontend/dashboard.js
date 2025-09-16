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

  const fetchJSON = window.fetchJSON || (async (path, opts={}) => {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
  });

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
      const debouncedRangeChange = window.debounce ? window.debounce(async () => {
        state.currentRange = String(rangeEl.value || '30');
        persistState();
        await Promise.all([loadSeries(), loadTopProjects()]);
      }, 500) : async () => {
        state.currentRange = String(rangeEl.value || '30');
        persistState();
        await Promise.all([loadSeries(), loadTopProjects()]);
      };
      on(rangeEl, 'change', debouncedRangeChange);
    }
    if (ownerEl) {
      const debouncedOwnerChange = window.debounce ? window.debounce(async () => {
        state.filters.owner = ownerEl.value.trim();
        await refreshAll();
      }, 500) : async () => {
        state.filters.owner = ownerEl.value.trim();
        await refreshAll();
      };
      on(ownerEl, 'change', debouncedOwnerChange);
    }
    if (statusEl) {
      const debouncedStatusChange = window.debounce ? window.debounce(async () => {
        state.filters.status = statusEl.value.trim();
        await refreshAll();
      }, 500) : async () => {
        state.filters.status = statusEl.value.trim();
        await refreshAll();
      };
      on(statusEl, 'change', debouncedStatusChange);
    }
  }

  async function syncPipefy() {
    const btnSync = $('#btnSync');
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
    bindShortcuts();

    const btnSync = document.getElementById('btnSync');
    on(btnSync, 'click', () => {
      if (location.pathname.endsWith('/dashboard.html')) {
        confirmAction('Sincronizar Pipefy → Projetos?', async () => {
          await syncPipefy();
        });
      } else {
        location.href = '/dashboard.html';
      }
    });

    const btnLogout = document.getElementById('btnLogout');
    on(btnLogout, 'click', () => {
      confirmAction('Deseja sair?', () => {
        if (typeof handleLogout === 'function') handleLogout();
      });
    });

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
    loadTopProjects,
    syncPipefy
  };

  // Dashboard com métricas melhoradas

  class Dashboard {
    constructor() {
      this.data = {
        projects: [],
        professionals: [],
        allocations: []
      };
    }

    async init() {
      await this.loadData();
      this.render();
      this.setupFilters();
    }

    async loadData() {
      try {
        const [projectsRes, professionalsRes, allocationsRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/professionals'),
          fetch('/api/allocations')
        ]);

        const projectsData = await projectsRes.json();
        this.data.projects = projectsData.data || projectsData;
        this.data.professionals = await professionalsRes.json();
        this.data.allocations = await allocationsRes.json();
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        showNotification('Erro ao carregar dados do dashboard', 'error');
      }
    }

    render() {
      const dashboardContainer = document.getElementById('dashboard');
      if (!dashboardContainer) return;

      dashboardContainer.innerHTML = `
        <div class="dashboard-header">
          <h2>📊 Dashboard PMO</h2>
          <div class="dashboard-filters">
            <select id="periodFilter">
              <option value="7">Últimos 7 dias</option>
              <option value="30" selected>Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
            <button onclick="dashboard.refresh()" class="btn-refresh">🔄 Atualizar</button>
          </div>
        </div>

        <div class="metrics-grid">
          ${this.renderMetricsCards()}
        </div>

        <div class="charts-grid">
          <div class="chart-container">
            <h3>📈 Horas por Profissional</h3>
            <div id="professionalsChart"></div>
          </div>
          
          <div class="chart-container">
            <h3>💰 Receita por Projeto</h3>
            <div id="revenueChart"></div>
          </div>
          
          <div class="chart-container">
            <h3>⏱️ Utilização dos Profissionais</h3>
            <div id="utilizationChart"></div>
          </div>
          
          <div class="chart-container">
            <h3>📅 Horas por Dia</h3>
            <div id="timelineChart"></div>
          </div>
        </div>

        <div class="tables-grid">
          <div class="table-container">
            <h3>🏆 Top Projetos por Receita</h3>
            <div id="topProjectsTable"></div>
          </div>
          
          <div class="table-container">
            <h3>👥 Performance dos Profissionais</h3>
            <div id="professionalsPerformanceTable"></div>
          </div>
        </div>
      `;

      this.renderCharts();
      this.renderTables();
    }

    renderMetricsCards() {
      const metrics = this.calculateMetrics();
      
      return `
        <div class="metric-card">
          <div class="metric-icon">💼</div>
          <div class="metric-content">
            <div class="metric-value">${metrics.totalProjects}</div>
            <div class="metric-label">Projetos Ativos</div>
            <div class="metric-change ${metrics.projectsChange >= 0 ? 'positive' : 'negative'}">
              ${metrics.projectsChange >= 0 ? '+' : ''}${metrics.projectsChange}% vs mês anterior
            </div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">👥</div>
          <div class="metric-content">
            <div class="metric-value">${metrics.totalProfessionals}</div>
            <div class="metric-label">Profissionais</div>
            <div class="metric-change positive">
              ${metrics.avgUtilization}% utilização média
            </div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">⏰</div>
          <div class="metric-content">
            <div class="metric-value">${metrics.totalHours}h</div>
            <div class="metric-label">Horas Alocadas</div>
            <div class="metric-change ${metrics.hoursChange >= 0 ? 'positive' : 'negative'}">
              ${metrics.hoursChange >= 0 ? '+' : ''}${metrics.hoursChange}% vs semana anterior
            </div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon">💰</div>
          <div class="metric-content">
            <div class="metric-value">R$ ${metrics.totalRevenue}</div>
            <div class="metric-label">Receita Estimada</div>
            <div class="metric-change positive">
              Média R$ ${metrics.avgHourlyRate}/h
            </div>
          </div>
        </div>
      `;
    }

    calculateMetrics() {
      const currentDate = new Date();
      const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const lastWeek = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Filtrar alocações recentes
      const recentAllocations = this.data.allocations.filter(a => {
        const allocDate = new Date(a.date);
        return allocDate >= lastMonth;
      });

      const totalHours = recentAllocations.reduce((sum, a) => sum + Number(a.hours), 0);
      const totalRevenue = recentAllocations.reduce((sum, a) => {
        const hours = Number(a.hours) || 0;
        const rate = Number(a.hourly_rate) || 0;
        return sum + (hours * rate);
      }, 0);

      // Calcular utilização média
      const professionalsWithUtilization = this.data.professionals.filter(p => p.utilization);
      const avgUtilization = professionalsWithUtilization.length > 0 
        ? (professionalsWithUtilization.reduce((sum, p) => sum + Number(p.utilization), 0) / professionalsWithUtilization.length * 100).toFixed(1)
        : 0;

      // Calcular taxa média
      const avgHourlyRate = this.data.professionals.filter(p => p.hourly_rate).length > 0
        ? (this.data.professionals.reduce((sum, p) => sum + (Number(p.hourly_rate) || 0), 0) / this.data.professionals.filter(p => p.hourly_rate).length).toFixed(0)
        : 0;

      return {
        totalProjects: this.data.projects.length,
        totalProfessionals: this.data.professionals.length,
        totalHours: totalHours.toFixed(1),
        totalRevenue: totalRevenue.toLocaleString('pt-BR'),
        avgUtilization,
        avgHourlyRate,
        projectsChange: Math.floor(Math.random() * 20) - 10, // Mock
        hoursChange: Math.floor(Math.random() * 30) - 15     // Mock
      };
    }

    renderCharts() {
      this.renderProfessionalsChart();
      this.renderRevenueChart();
      this.renderUtilizationChart();
      this.renderTimelineChart();
    }

    renderProfessionalsChart() {
      const profHours = {};
      
      this.data.allocations.forEach(alloc => {
        const profName = alloc.professional_name || `Prof ${alloc.professional_id}`;
        profHours[profName] = (profHours[profName] || 0) + Number(alloc.hours);
      });

      const chartData = Object.entries(profHours)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      const container = document.getElementById('professionalsChart');
      container.innerHTML = `
        <div class="simple-chart">
          ${chartData.map(([name, hours]) => `
            <div class="chart-bar">
              <div class="bar-label">${name}</div>
              <div class="bar-container">
                <div class="bar-fill" style="width: ${(hours / Math.max(...chartData.map(([,h]) => h))) * 100}%"></div>
                <div class="bar-value">${hours.toFixed(1)}h</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    renderRevenueChart() {
      const projectRevenue = {};
      
      this.data.allocations.forEach(alloc => {
        const projName = alloc.project_name || `Projeto ${alloc.project_id}`;
        const revenue = Number(alloc.hours) * Number(alloc.hourly_rate || 0);
        projectRevenue[projName] = (projectRevenue[projName] || 0) + revenue;
      });

      const chartData = Object.entries(projectRevenue)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);

      const container = document.getElementById('revenueChart');
      container.innerHTML = `
        <div class="simple-chart">
          ${chartData.map(([name, revenue]) => `
            <div class="chart-bar">
              <div class="bar-label">${name}</div>
              <div class="bar-container">
                <div class="bar-fill revenue" style="width: ${(revenue / Math.max(...chartData.map(([,r]) => r))) * 100}%"></div>
                <div class="bar-value">R$ ${revenue.toLocaleString('pt-BR')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    renderUtilizationChart() {
      const professionalsWithUtilization = this.data.professionals
        .filter(p => p.utilization)
        .sort((a, b) => Number(b.utilization) - Number(a.utilization));

      const container = document.getElementById('utilizationChart');
      container.innerHTML = `
        <div class="simple-chart">
          ${professionalsWithUtilization.map(prof => {
            const utilization = Number(prof.utilization) * 100;
            const utilizationClass = utilization >= 80 ? 'high' : utilization >= 60 ? 'medium' : 'low';
            
            return `
              <div class="chart-bar">
                <div class="bar-label">${prof.name} (${prof.role || 'N/A'})</div>
                <div class="bar-container">
                  <div class="bar-fill utilization ${utilizationClass}" style="width: ${utilization}%"></div>
                  <div class="bar-value">${utilization.toFixed(1)}%</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    renderTimelineChart() {
      // Agrupar horas por data
      const dailyHours = {};
      
      this.data.allocations.forEach(alloc => {
        const date = alloc.date;
        dailyHours[date] = (dailyHours[date] || 0) + Number(alloc.hours);
      });

      // Últimos 14 dias
      const dates = Object.keys(dailyHours)
        .sort()
        .slice(-14);

      const container = document.getElementById('timelineChart');
      container.innerHTML = `
        <div class="timeline-chart">
          ${dates.map(date => {
            const hours = dailyHours[date];
            const maxHours = Math.max(...Object.values(dailyHours));
            
            return `
              <div class="timeline-bar">
                <div class="timeline-fill" style="height: ${(hours / maxHours) * 100}%"></div>
                <div class="timeline-label">${new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</div>
                <div class="timeline-value">${hours.toFixed(1)}h</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    renderTables() {
      this.renderTopProjectsTable();
      this.renderProfessionalsPerformanceTable();
    }

    renderTopProjectsTable() {
      const projectStats = {};
      
      this.data.allocations.forEach(alloc => {
        const projId = alloc.project_id;
        const projName = alloc.project_name || `Projeto ${projId}`;
        
        if (!projectStats[projId]) {
          projectStats[projId] = {
            name: projName,
            hours: 0,
            revenue: 0,
            professionals: new Set()
          };
        }
        
        projectStats[projId].hours += Number(alloc.hours);
        projectStats[projId].revenue += Number(alloc.hours) * Number(alloc.hourly_rate || 0);
        projectStats[projId].professionals.add(alloc.professional_id);
      });

      const topProjects = Object.values(projectStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const container = document.getElementById('topProjectsTable');
      container.innerHTML = `
        <table class="performance-table">
          <thead>
            <tr>
              <th>Projeto</th>
              <th>Horas</th>
              <th>Receita</th>
              <th>Profissionais</th>
              <th>R$/Hora</th>
            </tr>
          </thead>
          <tbody>
            ${topProjects.map(proj => `
              <tr>
                <td>${proj.name}</td>
                <td>${proj.hours.toFixed(1)}h</td>
                <td>R$ ${proj.revenue.toLocaleString('pt-BR')}</td>
                <td>${proj.professionals.size}</td>
                <td>R$ ${proj.hours > 0 ? (proj.revenue / proj.hours).toFixed(0) : '0'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    renderProfessionalsPerformanceTable() {
      const profStats = {};
      
      this.data.allocations.forEach(alloc => {
        const profId = alloc.professional_id;
        const profName = alloc.professional_name || `Prof ${profId}`;
        
        if (!profStats[profId]) {
          profStats[profId] = {
            name: profName,
            role: alloc.professional_role || 'N/A',
            hours: 0,
            revenue: 0,
            projects: new Set(),
            hourly_rate: Number(alloc.hourly_rate || 0)
          };
        }
        
        profStats[profId].hours += Number(alloc.hours);
        profStats[profId].revenue += Number(alloc.hours) * Number(alloc.hourly_rate || 0);
        profStats[profId].projects.add(alloc.project_id);
      });

      const profPerformance = Object.values(profStats)
        .sort((a, b) => b.revenue - a.revenue);

      const container = document.getElementById('professionalsPerformanceTable');
      container.innerHTML = `
        <table class="performance-table">
          <thead>
            <tr>
              <th>Profissional</th>
              <th>Função</th>
              <th>Horas</th>
              <th>Receita</th>
              <th>Projetos</th>
              <th>Taxa/Hora</th>
            </tr>
          </thead>
          <tbody>
            ${profPerformance.map(prof => `
              <tr>
                <td>${prof.name}</td>
                <td>${prof.role}</td>
                <td>${prof.hours.toFixed(1)}h</td>
                <td>R$ ${prof.revenue.toLocaleString('pt-BR')}</td>
                <td>${prof.projects.size}</td>
                <td>R$ ${prof.hourly_rate.toFixed(0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    setupFilters() {
      const periodFilter = document.getElementById('periodFilter');
      if (periodFilter) {
        periodFilter.addEventListener('change', () => {
          this.filterByPeriod(periodFilter.value);
        });
      }
    }

    filterByPeriod(days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
      
      // Filtrar alocações
      this.data.allocations = this.data.allocations.filter(alloc => {
        const allocDate = new Date(alloc.date);
        return allocDate >= cutoffDate;
      });
      
      // Re-renderizar
      this.renderCharts();
      this.renderTables();
    }

    async refresh() {
      showNotification('Atualizando dashboard...');
      await this.loadData();
      this.render();
      showNotification('Dashboard atualizado!');
    }
  }

  // Instância global do dashboard
  let dashboard;

  // Inicializar quando a página carregar
  document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
    dashboard.init();
  });
})();
